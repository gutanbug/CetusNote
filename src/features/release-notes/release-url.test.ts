import { describe, expect, it } from "vitest";
import { releaseUrl, RELEASE_REPO } from "./release-url";

describe("releaseUrl", () => {
  it("builds the GitHub tag page for a plain version", () => {
    expect(releaseUrl("0.2.0")).toBe("https://github.com/gutanbug/CetusNote/releases/tag/v0.2.0");
    expect(RELEASE_REPO).toBe("gutanbug/CetusNote");
  });

  it("accepts a version that already has a v prefix", () => {
    expect(releaseUrl("v0.1.6")).toBe(releaseUrl("0.1.6"));
  });
});
