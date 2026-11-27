import { createPage, type Page } from "@/lib/storage";
import { describe, expect, it } from "vitest";
import { createSearchIndex, docText, normalize } from "./search-index";

const para = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
const page = (title: string, body: string[] = [], extra: Partial<Page> = {}): Page => ({
  ...createPage({ title }),
  content: { type: "doc", content: body.map(para) },
  ...extra,
});

describe("본문 글자 뽑기", () => {
  it("블록 사이는 줄바꿈, 수식은 LaTeX, 줄바꿈 노드는 공백", () => {
    expect(
      docText({
        type: "doc",
        content: [
          para("첫 문단"),
          { type: "heading", content: [{ type: "text", text: "제목" }] },
          {
            type: "paragraph",
            content: [
              { type: "text", text: "a" },
              { type: "hardBreak" },
              { type: "inlineMath", attrs: { latex: "x^2" } },
            ],
          },
        ],
      }),
    ).toBe("첫 문단\n제목\na x^2");
  });

  it("정규화: NFD 한글(맥 파일 이름 등)도 같은 글자로", () => {
    expect(normalize("회의".normalize("NFD"))).toBe("회의");
    expect(normalize("  Rust\n  소유권 ")).toBe("rust 소유권");
  });
});

describe("검색 (ADR-003: 부분 문자열)", () => {
  it("조사가 붙거나 단어 중간이어도 찾는다", () => {
    const idx = createSearchIndex();
    const a = page("주간 회의", ["디자인을 검토했어요"]);
    idx.build([a]);
    expect(idx.search("디자인")).toHaveLength(1);
    expect(idx.search("검토")).toHaveLength(1);
    expect(idx.search("자인")).toHaveLength(1);
  });

  it("띄어 쓴 검색어는 모두 있어야 나온다(AND), 대소문자 무시", () => {
    const idx = createSearchIndex();
    idx.build([page("Rust 메모", ["소유권과 빌림"]), page("Rust 설치", ["rustup으로 설치"])]);
    expect(idx.search("rust 소유권").map((r) => r.title)).toEqual(["Rust 메모"]);
    expect(idx.search("RUST")).toHaveLength(2);
    expect(idx.search("   ")).toEqual([]);
  });

  it("순위: 제목에 모두 있음 → 제목이 검색어로 시작 → 본문 횟수 → 최근 수정", () => {
    const idx = createSearchIndex();
    const body1 = page("메모", ["회의 회의 회의"], { updatedAt: "2026-11-19T01:00:00Z" });
    const body2 = page("다른 메모", ["회의"], { updatedAt: "2026-11-19T09:00:00Z" });
    const titleLater = page("주간 회의", [], { updatedAt: "2026-11-19T02:00:00Z" });
    const titleStart = page("회의록", [], { updatedAt: "2026-11-19T00:00:00Z" });
    idx.build([body1, body2, titleLater, titleStart]);
    expect(idx.search("회의").map((r) => r.title)).toEqual([
      "회의록",
      "주간 회의",
      "메모",
      "다른 메모",
    ]);
    expect(idx.search("회의")[0]!.matchIn).toBe("title");
    expect(idx.search("회의")[2]!.matchIn).toBe("body");
  });

  it("제목이 검색어와 똑같으면 맨 위 (문서 3 → 문서 39보다 먼저)", () => {
    const idx = createSearchIndex();
    const pages = Array.from({ length: 40 }, (_, i) =>
      page(`문서 ${i}`, [], { updatedAt: `2026-11-19T00:${String(i).padStart(2, "0")}:00Z` }),
    );
    idx.build(pages);
    const got = idx.search("문서 3").map((r) => r.title);
    expect(got[0]).toBe("문서 3");
    expect(got.slice(1, 3)).toEqual(["문서 39", "문서 38"]);
    expect(idx.search("문서 3 ").map((r) => r.title)[0]).toBe("문서 3");
  });

  it("제목 전체가 검색어로 시작하면 낱말이 흩어져 맞은 것보다 먼저", () => {
    const idx = createSearchIndex();
    const scattered = page("회의 주간 정리", [], { updatedAt: "2026-11-19T09:00:00Z" });
    const prefix = page("회의 정리 모음", [], { updatedAt: "2026-11-19T01:00:00Z" });
    idx.build([scattered, prefix]);
    expect(idx.search("회의 정리").map((r) => r.title)).toEqual([
      "회의 정리 모음",
      "회의 주간 정리",
    ]);
  });

  it("한글 초성으로 제목을 찾는다(본문도 초성으로 맞고, 본문에만 맞으면 뒤로)", () => {
    const idx = createSearchIndex();
    idx.build([
      page("주간 회의", []),
      page("회의록", []),
      page("메모", ["회의 내용"]),
      page("ㅎㅇ 메모", []),
    ]);
    expect(idx.search("ㅎㅇ").map((r) => r.title)).toEqual([
      "ㅎㅇ 메모",
      "회의록",
      "주간 회의",
      "메모",
    ]);
    expect(idx.search("ㅈㄱ ㅎㅇ").map((r) => r.title)).toEqual(["주간 회의"]);
    expect(idx.search("ㅎㅇㄹ").map((r) => r.title)).toEqual(["회의록"]);
    expect(idx.search("ㅁㅁ").map((r) => r.title)).toEqual(["메모", "ㅎㅇ 메모"]);
    expect(idx.search("ㅋㅋ")).toEqual([]);
  });

  it("초성이 섞인 검색어도 제목과 똑같으면 맨 위 (ㅁㅅ 3 → 문서 3)", () => {
    const idx = createSearchIndex();
    idx.build([
      page("문서 3", [], { updatedAt: "2026-11-19T00:00:00Z" }),
      page("문서 39", [], { updatedAt: "2026-11-19T09:00:00Z" }),
    ]);
    expect(idx.search("ㅁㅅ 3").map((r) => r.title)).toEqual(["문서 3", "문서 39"]);
  });

  it("발췌문과 강조 범위가 맞는다(앞을 잘랐으면 …)", () => {
    const idx = createSearchIndex();
    const long = "가".repeat(60) + " 이번 분기 로드맵을 정리했어요";
    idx.build([page("메모", [long])]);
    const [r] = idx.search("로드맵");
    expect(r!.snippet.startsWith("…")).toBe(true);
    const [s, e] = r!.highlights[0]!;
    expect(r!.snippet.slice(s, e)).toBe("로드맵");
  });

  it("휴지통 페이지는 빼고(옵션으로 포함), 폴더는 찾지 않는다", () => {
    const idx = createSearchIndex();
    const gone = page("지운 회의", [], { trashedAt: "2026-11-19T00:00:00Z" });
    const folder = { ...page("회의 폴더"), kind: "folder" as const };
    idx.build([gone, folder]);
    expect(idx.search("회의")).toEqual([]);
    expect(idx.search("회의", { includeTrashed: true }).map((r) => r.title)).toEqual(["지운 회의"]);
    expect(idx.size).toBe(1);
  });

  it("고치면 바로 반영되고, 지우면 사라진다", () => {
    const idx = createSearchIndex();
    const a = page("메모", ["사과"]);
    idx.build([a]);
    idx.upsert({ ...a, content: { type: "doc", content: [para("배")] } });
    expect(idx.search("사과")).toEqual([]);
    expect(idx.search("배")).toHaveLength(1);
    idx.remove(a.id);
    expect(idx.search("배")).toEqual([]);
  });
});

describe("본문 색인 미루기 (SYS-11)", () => {
  it("고친 페이지를 여러 번 고쳐도 찾기 결과는 마지막 본문이다", () => {
    const idx = createSearchIndex();
    const p = page("메모", ["처음 글"]);
    idx.build([p]);
    idx.upsert({ ...p, content: { type: "doc", content: [para("중간 글")] } });
    idx.upsert({ ...p, content: { type: "doc", content: [para("마지막 글")] } });
    expect(idx.search("처음")).toEqual([]);
    expect(idx.search("마지막")).toHaveLength(1);
  });

  it("색인을 미뤄 둔 채 지운 페이지는 나중에 되살아나지 않는다", () => {
    const idx = createSearchIndex();
    const p = page("지울 메모", ["되살아나면 안 되는 글"]);
    idx.build([]);
    idx.upsert(p);
    idx.remove(p.id);
    idx.flush();
    expect(idx.size).toBe(0);
    expect(idx.search("되살아나면")).toEqual([]);
  });

  it("flush 뒤의 결과는 바로 만든 것과 같다", () => {
    const eager = createSearchIndex();
    const lazy = createSearchIndex();
    const pages = [page("회의", ["안건 하나"]), page("계획", ["안건 둘", "예산"])];
    eager.build([]);
    lazy.build([]);
    for (const p of pages) {
      eager.upsert(p);
      eager.flush();
      lazy.upsert(p);
    }
    lazy.flush();
    expect(lazy.search("안건")).toEqual(eager.search("안건"));
    expect(lazy.search("예산")).toEqual(eager.search("예산"));
  });
});

describe("초성·섞인 검색어 (SRCH-04)", () => {
  it("본문에서도 초성과 섞인 검색어가 맞고, 강조는 본문 글자 위치", () => {
    const idx = createSearchIndex();
    idx.build([page("메모", ["내일 회의록 보내기"])]);
    const [r] = idx.search("ㅎㅇㄹ");
    expect(r?.matchIn).toBe("body");
    const [a, b] = r!.highlights[0]!;
    expect(r!.snippet.slice(a, b)).toBe("회의록");
    expect(idx.search("회ㅇ보")).toHaveLength(0);
    expect(idx.search("회ㅇ록")).toHaveLength(1);
  });

  it("입력 중인 마지막 음절은 받침이 달라도 맞는다(회의로 → 회의록)", () => {
    const idx = createSearchIndex();
    idx.build([page("회의록"), page("회의실")]);
    expect(idx.search("회의로").map((r) => r.title)).toEqual(["회의록"]);
    expect(idx.search("회의록").map((r) => r.title)).toEqual(["회의록"]);
  });

  it("글자 그대로 맞는 제목이 초성으로만 맞는 제목보다 위", () => {
    const idx = createSearchIndex();
    idx.build([
      page("회의 메모", [], { updatedAt: "2026-11-27T00:00:00.000Z" }),
      page("회의록", [], { updatedAt: "2026-11-01T00:00:00.000Z" }),
    ]);
    expect(idx.search("회의").map((r) => r.title)).toEqual(["회의 메모", "회의록"]);
    expect(idx.search("회ㅇ").map((r) => r.title)).toEqual(["회의 메모", "회의록"]);
    // 글자 그대로 "ㅎㅇ"가 든 제목 → 초성으로만 맞는 제목보다 앞
    const idx2 = createSearchIndex();
    idx2.build([page("회의록"), page("ㅎㅇ 정리")]);
    expect(idx2.search("ㅎㅇ").map((r) => r.title)).toEqual(["ㅎㅇ 정리", "회의록"]);
  });
});
