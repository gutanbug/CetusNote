import { describe, expect, it } from "vitest";
import { foldText, hangulPatterns, matchHangul } from "./hangul";

const m = (text: string, q: string) => matchHangul(foldText(text), q);

describe("섞인 검색어 (초성 + 글자)", () => {
  it("완성형 음절은 그 음절만, 초성은 그 초성의 음절 전부", () => {
    expect(m("회의록", "회ㅇㄹ")).toEqual([[0, 3]]);
    expect(m("회의록", "ㅎ의록")).toEqual([[0, 3]]);
    expect(m("호의록", "회ㅇㄹ")).toBeNull();
    expect(m("회의록", "회ㄹ")).toBeNull();
  });

  it("초성만 친 낱말도 음절과 자음 글자 자체에 맞는다", () => {
    expect(m("회의록", "ㅎㅇㄹ")).toEqual([[0, 3]]);
    expect(m("ㅎ 메모", "ㅎ")).toEqual([[0, 1]]);
    expect(m("호수", "ㅎ")).toEqual([[0, 1]]);
  });

  it("마지막 음절이 받침 없이 끝나면 같은 초성·중성이면 받침이 달라도 맞는다 (입력 중)", () => {
    expect(m("회의록", "회의로")).toEqual([[0, 3]]);
    expect(m("간", "가")).toEqual([[0, 1]]);
    expect(m("감", "가")).toEqual([[0, 1]]);
    expect(m("거", "가")).toBeNull();
    // 받침이 있는 마지막 음절은 그대로만
    expect(m("회의록", "회의락")).toBeNull();
    expect(m("간", "갈")).toBeNull();
  });

  it("입력 중 규칙은 마지막 글자에만 쓴다", () => {
    // 가운데 음절 "로"는 완성형이라 "록"에 맞지 않는다
    expect(m("록록", "로록")).toBeNull();
    expect(m("로록", "로록")).toEqual([[0, 2]]);
    // 마지막 "로"는 입력 중이라 "록"에 맞는다
    expect(m("록록", "록로")).toEqual([[0, 2]]);
  });

  it("띄어 쓴 낱말은 모두 들어 있어야 한다(AND)", () => {
    expect(m("주간 회의록", "ㅈㄱ 회ㅇ")).toEqual([
      [0, 2],
      [3, 5],
    ]);
    expect(m("주간 회의록", "ㅈㄱ 보고")).toBeNull();
  });
});

describe("기타 글자", () => {
  it("영문은 대소문자를 가리지 않는다", () => {
    expect(m("Meeting Notes", "MEET")).toEqual([[0, 4]]);
    expect(hangulPatterns("ABC")[0]!.literal).toBe(true);
  });

  it("특수 문자는 정규식 문법이 아니라 글자로 본다", () => {
    expect(m("a.b (c)", ".b")).toEqual([[1, 3]]);
    expect(m("a+b", "a+")).toEqual([[0, 2]]);
    expect(m("abc", "a.c")).toBeNull();
  });

  it("NFD로 들어온 입력과 제목도 NFC로 맞춘다", () => {
    expect(m("회의록".normalize("NFD"), "회의")).toEqual([[0, 2]]);
    expect(m("회의록", "회의".normalize("NFD"))).toEqual([[0, 2]]);
  });

  it("빈 검색어는 맞는 것이 없다", () => {
    expect(hangulPatterns("  ")).toEqual([]);
    expect(matchHangul("회의록", "")).toBeNull();
  });
});

describe("앞에서 맞추기 (사이드바 타이핑)", () => {
  it("제목의 맨 앞에서 검색어 전체가 맞아야 한다", () => {
    const p = (t: string, q: string) => matchHangul(foldText(t), q, { prefix: true });
    expect(p("회의록", "회ㅇ")).toEqual([[0, 2]]);
    expect(p("회의록", "회의로")).toEqual([[0, 3]]);
    expect(p("회의록", "의록")).toBeNull();
    expect(p("주간 회의록", "회")).toBeNull();
  });
});
