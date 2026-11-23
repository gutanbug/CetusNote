import { describe, expect, it } from "vitest";
import { normalizeZoom, stepZoom, ZOOM_STEPS, zoomKey } from "./zoom";

describe("화면 크기 (SHELL-17)", () => {
  it("80%~150% 단계", () => {
    expect(ZOOM_STEPS[0]).toBe(0.8);
    expect(ZOOM_STEPS[ZOOM_STEPS.length - 1]).toBe(1.5);
  });
  it("한 단계씩 오가고 끝에서 멈춘다", () => {
    expect(stepZoom(1, 1)).toBe(1.1);
    expect(stepZoom(1.1, 1)).toBe(1.25);
    expect(stepZoom(1.5, 1)).toBe(1.5);
    expect(stepZoom(1, -1)).toBe(0.9);
    expect(stepZoom(0.8, -1)).toBe(0.8);
    expect(stepZoom(1.25, 0)).toBe(1);
  });
  it("저장된 값은 가장 가까운 단계로, 모르는 값은 100%", () => {
    expect(normalizeZoom(1.2)).toBe(1.25);
    expect(normalizeZoom(3)).toBe(1.5);
    expect(normalizeZoom(0.1)).toBe(0.8);
    expect(normalizeZoom("big")).toBe(1);
    expect(normalizeZoom(Number.NaN)).toBe(1);
  });
  it("단축키: ⌘= ⌘+ 키우기, ⌘- 줄이기, ⌘0 원래대로", () => {
    const k = (key: string, mod = { metaKey: true, ctrlKey: false, altKey: false }) =>
      zoomKey({ key, ...mod });
    expect(k("=")).toBe(1);
    expect(k("+")).toBe(1);
    expect(k("-")).toBe(-1);
    expect(k("0")).toBe(0);
    expect(k("=", { metaKey: false, ctrlKey: true, altKey: false })).toBe(1);
    expect(k("=", { metaKey: false, ctrlKey: false, altKey: false })).toBeNull();
    expect(k("=", { metaKey: true, ctrlKey: false, altKey: true })).toBeNull();
    expect(k("1")).toBeNull();
  });
});
