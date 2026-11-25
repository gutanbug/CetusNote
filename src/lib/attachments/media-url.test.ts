import { describe, expect, it } from "vitest";
import { withFirstFrame } from "./media-url";

describe("영상 첫 프레임 주소", () => {
  it("조각이 없으면 0.001초 위치를 붙인다", () => {
    expect(withFirstFrame("asset://localhost/assets/01J/clip.mp4")).toBe(
      "asset://localhost/assets/01J/clip.mp4#t=0.001",
    );
  });

  it("이미 조각이 있으면 그대로 둔다", () => {
    expect(withFirstFrame("http://asset.localhost/assets/01J/clip.mov#t=5")).toBe(
      "http://asset.localhost/assets/01J/clip.mov#t=5",
    );
  });

  it("질의 문자열이 있어도 뒤에 조각만 붙인다", () => {
    expect(withFirstFrame("http://asset.localhost/a/b.webm?v=2")).toBe(
      "http://asset.localhost/a/b.webm?v=2#t=0.001",
    );
  });
});
