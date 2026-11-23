import { describe, expect, it } from "vitest";
import { CHECK_INTERVAL_MS, isCheckDue, isNewerVersion, parseVersion } from "./version";

describe("버전 비교 (SYS-07)", () => {
  it("본판 숫자를 차례로 비교한다. 자릿수가 달라도 맞게 비교한다", () => {
    expect(isNewerVersion("0.2.0", "0.1.0")).toBe(true);
    expect(isNewerVersion("0.10.0", "0.9.9")).toBe(true);
    expect(isNewerVersion("1.0.0", "0.99.99")).toBe(true);
    expect(isNewerVersion("0.1.0", "0.1.0")).toBe(false);
    expect(isNewerVersion("0.1.0", "0.2.0")).toBe(false);
  });

  it("앞의 v와 빠진 자리(0.2 = 0.2.0)를 같은 값으로 본다", () => {
    expect(isNewerVersion("v0.2.0", "0.1.0")).toBe(true);
    expect(isNewerVersion("0.2", "0.2.0")).toBe(false);
    expect(parseVersion("1")).toEqual({ core: [1, 0, 0], pre: null });
  });

  it("같은 본판이면 정식판이 프리릴리스보다 새 것이다", () => {
    expect(isNewerVersion("0.2.0", "0.2.0-beta.1")).toBe(true);
    expect(isNewerVersion("0.2.0-beta.1", "0.2.0")).toBe(false);
    expect(isNewerVersion("0.2.0-beta.2", "0.2.0-beta.1")).toBe(true);
  });

  it("해석할 수 없는 값은 새 버전이 아니다", () => {
    expect(isNewerVersion("latest", "0.1.0")).toBe(false);
    expect(isNewerVersion("0.2.0", "")).toBe(false);
    expect(parseVersion("1.2.3.4")).toBeNull();
  });
});

describe("하루 한 번 확인 간격 (SYS-07)", () => {
  const day = CHECK_INTERVAL_MS;
  it("한 번도 안 했으면 확인한다", () => {
    expect(isCheckDue(null, 1_000)).toBe(true);
  });

  it("하루가 안 지났으면 확인하지 않고, 하루가 지나면 확인한다", () => {
    const last = 1_000_000;
    expect(isCheckDue(last, last + day - 1)).toBe(false);
    expect(isCheckDue(last, last + day)).toBe(true);
  });

  it("시계가 뒤로 가면 확인한다", () => {
    expect(isCheckDue(5_000_000, 1_000)).toBe(true);
  });
});
