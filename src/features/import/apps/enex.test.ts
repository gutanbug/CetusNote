// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ENEX_CRYPT_TEXT, convertEnex, convertEnexFile, parseEnexDate } from "./enex";
import { md5Hex } from "./md5";

const here = dirname(fileURLToPath(import.meta.url));
const sample = readFileSync(join(here, "fixtures/evernote-sample.enex"), "utf-8");

describe("md5Hex", () => {
  it("RFC 1321 기준 값과 맞는다", () => {
    const bytes = (s: string) => new TextEncoder().encode(s);
    expect(md5Hex(bytes(""))).toBe("d41d8cd98f00b204e9800998ecf8427e");
    expect(md5Hex(bytes("abc"))).toBe("900150983cd24fb0d6963f7d28e17f72");
    expect(md5Hex(bytes("a".repeat(100)))).toBe("36a92cc94a9e0fa21f625f8bfb007adf");
  });
});

describe("parseEnexDate", () => {
  it("Evernote 날짜를 ISO로 바꾼다", () => {
    expect(parseEnexDate("20240101T120000Z")).toBe("2024-01-01T12:00:00.000Z");
    expect(parseEnexDate("어제")).toBeUndefined();
  });
});

describe("convertEnex", () => {
  const result = convertEnex([{ name: "업무.enex", text: sample }]);
  const folder = result.nodes.find((n) => n.kind === "folder")!;
  const [memo, diary] = result.nodes.filter((n) => n.kind === "page");

  it("파일 하나를 노트북 폴더로, 노트 하나를 문서로 만든다", () => {
    expect(folder.title).toBe("업무");
    expect(result.nodes.filter((n) => n.kind === "page")).toHaveLength(2);
    expect(memo!.parentKey).toBe(folder.key);
    expect(memo!.title).toBe("회의 메모");
    expect(memo!.tags).toEqual(["업무", "회의"]);
    expect(memo!.createdAt).toBe("2024-01-01T12:00:00.000Z");
    expect(memo!.updatedAt).toBe("2024-01-02T09:00:00.000Z");
    expect(memo!.format).toBe("html");
  });

  it("체크 항목을 작업 목록으로 묶는다", () => {
    expect(memo!.markdown).toContain(
      '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>보고서 작성</p></li><li data-type="taskItem" data-checked="false"><p>메일 보내기</p></li></ul>',
    );
  });

  it("그림과 PDF를 리소스 MD5로 찾아 blob으로 넘긴다", () => {
    const png = memo!.assetPaths.find((k) => k.startsWith("enex/"))!;
    expect(memo!.markdown).toContain(`<figure data-local="${png}"></figure>`);
    expect(result.blobs.get(png)?.length).toBeGreaterThan(0);
    expect(md5Hex(result.blobs.get(png)!)).toBe(png.slice("enex/".length));
    expect(memo!.markdown).toMatch(
      /data-attachment="" data-path="enex\/[0-9a-f]{32}" data-name="spec.pdf" data-size="\d+" data-mime="application\/pdf" data-kind="pdf"/,
    );
  });

  it("원본이 없는 그림은 건너뛰고 개수를 남긴다", () => {
    expect(memo!.markdown).not.toContain("0000000000000000");
    expect(result.skipped).toContain("회의 메모 (그림 1개의 원본이 없어요)");
  });

  it("암호화된 노트는 안내 글만 남긴다", () => {
    expect(diary!.markdown).toBe(`<p>${ENEX_CRYPT_TEXT}</p>`);
    expect(diary!.tags).toEqual([]);
    expect(result.error).toBeNull();
  });

  it("잘못된 XML 파일은 건너뛰고 나머지는 가져온다", () => {
    const mixed = convertEnex([
      { name: "깨짐.enex", text: "<en-export><note><title>x" },
      { name: "정상.enex", text: sample },
    ]);
    expect(mixed.skipped[0]).toContain("깨짐.enex");
    expect(mixed.nodes.filter((n) => n.kind === "page")).toHaveLength(2);
  });

  it("한 개도 읽지 못하면 해요체 안내를 돌려준다", () => {
    const bad = convertEnex([{ name: "깨짐.enex", text: "<en-export><note>" }]);
    expect(bad.nodes).toEqual([]);
    expect(bad.error).toMatch(/ENEX 형식으로 내보낸 파일인지 확인해 주세요$/);
  });
});

describe("convertEnex: 가장자리 노트 (표·중첩 목록·링크·할 일·리소스)", () => {
  const edge = readFileSync(join(here, "fixtures/evernote-edge.enex"), "utf-8");
  const result = convertEnex([{ name: "edge.enex", text: edge }]);
  const pages = result.nodes.filter((n) => n.kind === "page");
  const html = (title: string) => pages.find((p) => p.title === title)?.markdown ?? "";

  it("표·중첩 목록·링크를 깨뜨리지 않고 글을 살린다", () => {
    const body = html("표와 목록");
    for (const text of [
      "셀 하나",
      "셀 둘",
      "셋",
      "넷",
      "상위 항목",
      "하위 항목",
      "더 아래",
      "예제 링크",
    ])
      expect(body).toContain(text);
    expect(body).toContain('href="https://example.com/docs"');
    expect(body).toContain("<table");
    expect(body).toMatch(/<ul>[\s\S]*<ul>[\s\S]*<ul>/);
  });

  it("목록 안의 체크·미체크 할 일은 글로 남는다(체크 상태는 목록 항목에 잡히는 경우만)", () => {
    const body = html("표와 목록");
    expect(body).toContain("완료한 일");
    expect(body).toContain("남은 일");
  });

  it("같은 md5 리소스는 한 번만 담기고, 파일 이름이 없으면 「첨부 파일」이다", () => {
    const body = html("그림과 첨부");
    const figures = body.match(/data-local="enex\/[0-9a-f]+"/g) ?? [];
    expect(figures).toHaveLength(2);
    expect(new Set(figures).size).toBe(1);
    expect(body).toContain('data-name="첨부 파일"');
    expect(result.blobs.size).toBe(2);
    expect(pages.find((p) => p.title === "그림과 첨부")?.assetPaths).toHaveLength(2);
  });

  it("원본이 없는 그림은 건너뛰고 요약에 남긴다", () => {
    expect(result.skipped.some((s) => s.includes("그림과 첨부") && s.includes("그림 1개"))).toBe(
      true,
    );
  });

  it("제목만 있는 노트도 빈 페이지로 가져온다", () => {
    const page = pages.find((p) => p.title === "제목만 있는 노트");
    expect(page).toBeDefined();
    expect(page?.markdown).toBe("");
    expect(page?.assetPaths).toEqual([]);
  });

  it("파일 하나씩 변환해도(convertEnexFile) 폴더 키가 겹치지 않는다", () => {
    const blobs = new Map<string, Uint8Array>();
    const a = convertEnexFile({ name: "a.enex", text: sample }, 0, blobs);
    const b = convertEnexFile({ name: "b.enex", text: edge }, 1, blobs);
    expect(a.read && b.read).toBe(true);
    const keys = [...a.nodes, ...b.nodes].map((n) => n.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(convertEnexFile({ name: "x.enex", text: "<broken" }, 2, blobs).read).toBe(false);
  });
});
