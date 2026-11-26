import { describe, expect, it } from "vitest";
import { extractSection, promoteUnreleased, today } from "./changelog.mjs";
import { versionFromTag } from "./release-notes.mjs";

const DOC = `# Changelog

## [Unreleased]

### Added

- New thing.

## [0.2.0] - 2026-01-02

### Fixed

- Bug.

## [0.1.0] - 2025-12-01

### Added

- First.

[Unreleased]: https://github.com/o/r/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/o/r/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/o/r/releases/tag/v0.1.0
`;

describe("extractSection", () => {
  it("returns the body of a version without its heading or link block", () => {
    expect(extractSection(DOC, "0.2.0")).toBe("### Fixed\n\n- Bug.");
    expect(extractSection(DOC, "0.1.0")).toBe("### Added\n\n- First.");
  });

  it("reads the Unreleased section too", () => {
    expect(extractSection(DOC, "Unreleased")).toBe("### Added\n\n- New thing.");
  });

  it("fails clearly when the version is missing", () => {
    expect(() => extractSection(DOC, "9.9.9")).toThrow(/9\.9\.9 섹션이 없어요/);
  });

  it("fails when the section is empty", () => {
    const empty = "## [0.3.0] - 2026-02-02\n\n\n## [0.2.0] - 2026-01-02\n\n- x\n";
    expect(() => extractSection(empty, "0.3.0")).toThrow(/비어 있어요/);
  });
});

describe("promoteUnreleased", () => {
  it("moves Unreleased into a dated section and keeps an empty Unreleased", () => {
    const out = promoteUnreleased(DOC, { version: "0.3.0", date: "2026-03-04" });
    expect(out).toContain(
      "## [Unreleased]\n\n## [0.3.0] - 2026-03-04\n\n### Added\n\n- New thing.\n\n## [0.2.0]",
    );
    expect(extractSection(out, "0.3.0")).toBe("### Added\n\n- New thing.");
  });

  it("rewrites compare links from the previous tag to the new one", () => {
    const out = promoteUnreleased(DOC, { version: "0.3.0", date: "2026-03-04" });
    expect(out).toContain(
      "[Unreleased]: https://github.com/o/r/compare/v0.3.0...HEAD\n[0.3.0]: https://github.com/o/r/compare/v0.2.0...v0.3.0\n[0.2.0]:",
    );
  });

  it("refuses an empty Unreleased section", () => {
    const empty = DOC.replace("- New thing.\n", "");
    expect(() => promoteUnreleased(empty, { version: "0.3.0", date: "2026-03-04" })).toThrow(
      /비어 있어요/,
    );
  });

  it("refuses a version that already has a section", () => {
    expect(() => promoteUnreleased(DOC, { version: "0.2.0", date: "2026-03-04" })).toThrow(/이미/);
  });

  it("validates version and date", () => {
    expect(() => promoteUnreleased(DOC, { version: "v0.3.0", date: "2026-03-04" })).toThrow(
      /X\.Y\.Z/,
    );
    expect(() => promoteUnreleased(DOC, { version: "0.3.0", date: "2026/03/04" })).toThrow(
      /YYYY-MM-DD/,
    );
  });
});

describe("helpers", () => {
  it("formats today in local time", () => {
    expect(today(new Date(2026, 0, 9, 23, 30))).toBe("2026-01-09");
  });

  it("accepts tags with or without the v prefix", () => {
    expect(versionFromTag("v0.1.6")).toBe("0.1.6");
    expect(versionFromTag("0.1.6")).toBe("0.1.6");
    expect(() => versionFromTag("latest")).toThrow(/버전 형식/);
  });
});
