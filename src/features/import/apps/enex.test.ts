// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ENEX_CRYPT_TEXT, convertEnex, parseEnexDate } from "./enex";
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
