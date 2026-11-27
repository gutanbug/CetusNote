import { describe, expect, it } from "vitest";
import { evaluate, evaluateLines, formatValue, todayOf } from ".";

// 2026-11-27 (금) 낮
const NOW = new Date(2026, 10, 27, 13, 0);
const today = todayOf(NOW);
const calc = (text: string, vars?: Map<string, never>) => {
  const r = evaluate(text, { today, vars });
  return r ? formatValue(r.value, today) : null;
};
/** 줄들을 계산해 보이는 결과만 */
const shown = (...lines: string[]) => evaluateLines(lines, NOW).map((r) => r?.text ?? null);

describe("식 계산 (EDIT-38)", () => {
  it("사칙연산 · 괄호 · 거듭제곱 · 음수 · 연산 순서", () => {
    expect(calc("1 + 2 * 3")).toBe("7");
    expect(calc("(1 + 2) * 3")).toBe("9");
    expect(calc("2 ^ 3 ^ 2")).toBe("512");
    expect(calc("-2 ^ 2")).toBe("-4");
    expect(calc("10 ÷ 4 × 2")).toBe("5");
    expect(calc("0.1 + 0.2")).toBe("0.3");
    expect(calc("1 / 3")).toBe("0.3333");
    expect(calc("1 / 0")).toBeNull();
    expect(calc("(1 + 2")).toBe("3");
  });

  it("숫자: 쉼표 · 만/억 단위", () => {
    expect(calc("12,000 + 4,500")).toBe("16,500");
    expect(calc("3만 + 5천")).toBe("35,000");
    expect(calc("1억 2천만 / 2")).toBe("60,000,000");
    expect(calc("1.5만원 * 2")).toBe("30,000원");
  });

  it("낱말은 이름표로 건너뛴다", () => {
    expect(calc("점심 12,000 + 커피 4,500")).toBe("16,500");
    expect(calc("오늘 점심 12,000원 + 커피 4,500원")).toBe("16,500원");
    expect(calc("결과는 다음과 같다")).toBeNull();
    // 숫자에 붙은 모르는 낱말은 숫자까지 이름표
    expect(calc("2층 회의실 3 + 4")).toBe("7");
    expect(calc("1년이면 (2 + 3) × 12")).toBe("60");
  });

  it("통화: 같은 통화끼리만, 원은 정수 · 달러는 소수 둘째 자리", () => {
    expect(calc("12,000원 + 4,500원")).toBe("16,500원");
    expect(calc("12,000원 * 3")).toBe("36,000원");
    expect(calc("$12.5 + $3")).toBe("$15.50");
    expect(calc("₩1,000 + 500")).toBe("1,500원");
    expect(calc("10,000원 / 3")).toBe("3,333원");
    expect(calc("10,000원 / 2,000원")).toBe("5");
    expect(calc("1,000원 + $1")).toBeNull();
  });

  it("퍼센트", () => {
    expect(calc("50,000 + 10%")).toBe("55,000");
    expect(calc("50,000원 - 20%")).toBe("40,000원");
    expect(calc("50,000의 20%")).toBe("10,000");
    expect(calc("50,000원의 20%")).toBe("10,000원");
    expect(calc("20% of 50000")).toBe("10,000");
    expect(calc("200 * 15%")).toBe("30");
    expect(calc("10% + 5%")).toBe("15%");
  });

  it("시간 길이", () => {
    expect(calc("2시간 30분 × 4")).toBe("10시간");
    expect(calc("90분")).toBe("1시간 30분");
    expect(calc("1.5시간 + 20분")).toBe("1시간 50분");
    expect(calc("3주")).toBe("21일");
    expect(calc("8시간 / 30분")).toBe("16");
    expect(calc("1년 + 14개월")).toBe("2년 2개월");
    expect(calc("2시간 - 3시간")).toBe("-1시간");
  });

  it("날짜: 오늘 기준, 더하기 · 빼기 · 남은 날", () => {
    expect(calc("오늘")).toBe("11월 27일 (금)");
    expect(calc("오늘 + 3주")).toBe("12월 18일 (금)");
    expect(calc("3주 후")).toBe("12월 18일 (금)");
    expect(calc("10일 전")).toBe("11월 17일 (화)");
    expect(calc("내일 + 1개월")).toBe("12월 28일 (월)");
    expect(calc("12월 25일 - 오늘")).toBe("28일");
    expect(calc("12월 25일까지")).toBe("28일");
    expect(calc("2027-01-01 - 2026-12-25")).toBe("7일");
    expect(calc("2027년 3월 1일")).toBe("2027년 3월 1일 (월)");
    expect(calc("1월 31일 + 1개월")).toBe("2월 28일 (토)");
    expect(calc("2월 30일")).toBeNull();
    expect(calc("오늘 + 오늘")).toBeNull();
  });
});

describe("계산 줄 (EDIT-38)", () => {
  it("줄 끝 `=` 에만 결과를 보여 준다", () => {
    expect(shown("점심 12,000 + 커피 4,500 =", "점심 12,000 + 커피 4,500", "2 + 2 = 4")).toEqual([
      "16,500",
      null,
      null,
    ]);
  });

  it("숫자 하나만 쓴 줄은 결과를 보이지 않는다", () => {
    expect(shown("12,000 =", "2026년 =", "90분 =")).toEqual([null, null, "1시간 30분"]);
  });

  it("이름을 정해 아래 줄에서 쓴다 (조사가 붙어도)", () => {
    expect(
      shown(
        "월세 = 650,000원",
        "관리비 = 120,000원",
        "월세 + 관리비 =",
        "월세의 10% =",
        "연간 = (월세 + 관리비) * 12 =",
      ),
    ).toEqual([null, null, "770,000원", "65,000원", "9,240,000원"]);
  });

  it("이름은 정한 뒤에만 쓸 수 있고, 다시 정하면 바뀐다", () => {
    expect(shown("a + 1 =", "a = 1", "a + 1 =", "a = 10", "a + 1 =")).toEqual([
      null,
      null,
      "2",
      null,
      "11",
    ]);
  });

  it("단위·날짜 말은 이름이 되지 않는다", () => {
    expect(shown("오늘 = 3", "오늘 + 1일 =")).toEqual([null, "11월 28일 (토)"]);
  });

  it("합계 · 평균은 바로 위 줄들(빈 줄까지)을 센다", () => {
    expect(
      shown(
        "식비",
        "점심 12,000원",
        "커피 4,500원 =",
        "저녁 15,000원",
        "합계 =",
        "",
        "a 10",
        "b 20",
        "평균 =",
      ),
    ).toEqual([null, null, null, null, "31,500원", null, null, null, "15"]);
  });

  it("합계는 다른 합계 줄에서 끊고, 결과를 넣은 줄은 결과 값을 센다", () => {
    expect(shown("1", "2", "소계 =", "점심 1,000 + 500 = 1,500", "합계 =")).toEqual([
      null,
      null,
      "3",
      null,
      "1,500",
    ]);
  });

  it("더할 수 없는 값이 섞이면 합계를 보이지 않는다", () => {
    expect(shown("10,000원", "3시간", "합계 =")).toEqual([null, null, null]);
  });
});
