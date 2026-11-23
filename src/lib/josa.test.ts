import { describe, expect, it } from "vitest";
import { roParticle } from "./josa";

describe("roParticle — 로/으로 조사", () => {
  it("한글: 받침 없음·ㄹ 받침은 로, 그 밖의 받침은 으로", () => {
    expect(roParticle("문서")).toBe("로"); // 없음
    expect(roParticle("일")).toBe("로"); // ㄹ
    expect(roParticle("책")).toBe("으로"); // ㄱ
    expect(roParticle("공부")).toBe("로"); // 끝 글자 부 (없음)
    expect(roParticle("할 일 ")).toBe("로"); // 뒤 공백 무시
    expect(roParticle("회의록")).toBe("으로"); // ㄱ
  });

  it("숫자: 마지막 숫자의 한글 읽기 기준", () => {
    expect(roParticle("0")).toBe("으로"); // 영
    expect(roParticle("1")).toBe("로"); // 일
    expect(roParticle("2")).toBe("로"); // 이
    expect(roParticle("3")).toBe("으로"); // 삼
    expect(roParticle("4")).toBe("로"); // 사
    expect(roParticle("5")).toBe("로"); // 오
    expect(roParticle("6")).toBe("으로"); // 육
    expect(roParticle("7")).toBe("로"); // 칠
    expect(roParticle("8")).toBe("로"); // 팔
    expect(roParticle("9")).toBe("로"); // 구
    expect(roParticle("2024년 3")).toBe("으로");
  });

  it("영문: 글자 이름 읽기의 받침 기준 (대소문자 무관)", () => {
    expect(roParticle("Notes L")).toBe("로"); // 엘
    expect(roParticle("plan r")).toBe("로"); // 아르
    expect(roParticle("team M")).toBe("으로"); // 엠
    expect(roParticle("web N")).toBe("으로"); // 엔
    expect(roParticle("Mac C")).toBe("로"); // 씨
    expect(roParticle("ios S")).toBe("으로"); // 에스
  });

  it("판단할 수 없으면 (으)로: 기호·이모지·빈 값", () => {
    expect(roParticle("")).toBe("(으)로");
    expect(roParticle("   ")).toBe("(으)로");
    expect(roParticle("★")).toBe("(으)로");
    expect(roParticle("📝")).toBe("(으)로");
    expect(roParticle("ㅋ")).toBe("(으)로"); // 자음만 있는 글자는 음절이 아니다
    expect(roParticle("태그!")).toBe("(으)로");
  });
});
