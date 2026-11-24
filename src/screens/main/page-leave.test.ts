import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enterPage, leavePage } from "./page-leave";

describe("페이지 화면을 떠날 때 찾기·목차 닫기 (EDIT-25, PAGE-12)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("떠나면 닫는다", () => {
    const close = vi.fn();
    leavePage("A", close);
    expect(close).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("같은 페이지 화면이 바로 다시 만들어지면(외부 변경 remount) 닫지 않는다", () => {
    const close = vi.fn();
    leavePage("A", close); // 이전 화면 정리
    enterPage("A"); // 같은 커밋에서 새 화면이 붙음
    vi.runAllTimers();
    expect(close).not.toHaveBeenCalled();
  });

  it("다른 페이지로 옮기면 이전 페이지의 찾기·목차는 닫는다", () => {
    const close = vi.fn();
    leavePage("A", close);
    enterPage("B");
    vi.runAllTimers();
    expect(close).toHaveBeenCalledTimes(1);
  });
});
