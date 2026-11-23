import { describe, expect, it } from "vitest";
import { docStats, formatDocStats } from "./stats";

const p = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
const doc = (...content: unknown[]) => ({ type: "doc", content });

describe("글자·단어 수 (PAGE-11)", () => {
  it("빈 문서", () => {
    const s = docStats(doc({ type: "paragraph" }));
    expect(s).toEqual({ chars: 0, charsNoSpace: 0, words: 0, minutes: 0 });
    expect(formatDocStats(s)).toBe("아직 글이 없어요");
  });

  it("공백 포함·제외 글자, 띄어쓰기 단어, 블록 사이 줄바꿈은 세지 않는다", () => {
    const s = docStats(doc(p("회의 메모"), p("Rust 소유권")));
    expect(s.chars).toBe(5 + 8);
    expect(s.charsNoSpace).toBe(4 + 7);
    expect(s.words).toBe(4);
    expect(s.minutes).toBe(1);
  });

  it("NFD 한글도 한 글자로", () => {
    expect(docStats(doc(p("회의".normalize("NFD")))).chars).toBe(2);
  });

  it("읽는 시간: 한글 500자 ≈ 1분, 영어 200단어 ≈ 1분", () => {
    expect(docStats(doc(p("가".repeat(1500)))).minutes).toBe(3);
    expect(docStats(doc(p(Array(600).fill("word").join(" ")))).minutes).toBe(3);
  });

  it("숫자는 천 단위 쉼표", () => {
    const s = docStats(doc(p("가".repeat(1234))));
    expect(formatDocStats(s)).toBe("글자 1,234 · 단어 1 · 약 2분");
  });
});
