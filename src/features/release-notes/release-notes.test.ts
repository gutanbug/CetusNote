import { describe, expect, it } from "vitest";
import { extractSection, parseBlocks, parseInline } from "./changelog";
import { decideWhatsNew, readItem, writeItem } from "./seen";

const DOC = `# Changelog

## [Unreleased]

### Added

- Pending thing.

## [0.1.6] - 2026-12-01

### Added

- Ship **bold** and \`code\` with [docs](https://example.com/docs).
- A long item
  that continues here.

### Fixed

Plain paragraph
on two lines.

## [0.1.5] - 2026-11-25

### Fixed

- Old fix.

[Unreleased]: https://github.com/o/r/compare/v0.1.6...HEAD
`;

describe("extractSection", () => {
  it("returns the body for a version and stops at the next version", () => {
    const body = extractSection(DOC, "0.1.6");
    expect(body).toContain("### Fixed");
    expect(body).not.toContain("Old fix");
    expect(body).not.toContain("compare/");
  });

  it("returns null for a missing or heading-only section", () => {
    expect(extractSection(DOC, "9.9.9")).toBeNull();
    expect(
      extractSection("## [0.2.0] - 2026-01-01\n\n### Added\n\n## [0.1.0] - x\n", "0.2.0"),
    ).toBeNull();
  });
});

describe("parseBlocks", () => {
  it("splits headings, lists and paragraphs and joins wrapped lines", () => {
    const blocks = parseBlocks(extractSection(DOC, "0.1.6") ?? "");
    expect(blocks.map((b) => b.kind)).toEqual(["heading", "list", "heading", "paragraph"]);
    const list = blocks[1];
    expect(list.kind === "list" && list.items).toEqual([
      "Ship **bold** and `code` with [docs](https://example.com/docs).",
      "A long item that continues here.",
    ]);
    expect(blocks[3]).toEqual({ kind: "paragraph", text: "Plain paragraph on two lines." });
  });
});

describe("parseInline", () => {
  it("separates bold, code and http links and keeps other links as text", () => {
    expect(parseInline("a **b** `c` [d](https://x.dev) [e](javascript:void)")).toEqual([
      { kind: "text", text: "a " },
      { kind: "bold", text: "b" },
      { kind: "text", text: " " },
      { kind: "code", text: "c" },
      { kind: "text", text: " " },
      { kind: "link", text: "d", href: "https://x.dev" },
      { kind: "text", text: " " },
      { kind: "text", text: "e" },
    ]);
  });
});

describe("decideWhatsNew", () => {
  const base = { lastSeen: "0.1.5", pending: null, current: "0.1.6", hasNotes: true };

  it("shows after an in-app update (pending marker matches) and clears the marker", () => {
    expect(decideWhatsNew({ ...base, pending: "0.1.6" })).toEqual({
      show: true,
      record: "0.1.6",
      clearPending: true,
    });
  });

  it("shows when the stored version is older than the current one", () => {
    expect(decideWhatsNew(base)).toMatchObject({ show: true, record: "0.1.6" });
  });

  it("does not show on first install (nothing stored) but records the version", () => {
    expect(decideWhatsNew({ ...base, lastSeen: null })).toEqual({
      show: false,
      record: "0.1.6",
      clearPending: false,
    });
  });

  it("does not show again for the same version or after a downgrade", () => {
    expect(decideWhatsNew({ ...base, lastSeen: "0.1.6" })).toMatchObject({
      show: false,
      record: null,
    });
    expect(decideWhatsNew({ ...base, lastSeen: "0.2.0" })).toMatchObject({
      show: false,
      record: "0.1.6",
    });
  });

  it("does not show when the version has no notes", () => {
    expect(decideWhatsNew({ ...base, pending: "0.1.6", hasNotes: false })).toMatchObject({
      show: false,
    });
  });

  it("ignores a current version it cannot parse", () => {
    expect(decideWhatsNew({ ...base, current: "dev" })).toEqual({
      show: false,
      record: null,
      clearPending: false,
    });
  });
});

describe("device storage helpers", () => {
  it("reads and writes without throwing when storage is missing or broken", () => {
    const items = new Map<string, string>();
    const fake = {
      getItem: (k: string) => items.get(k) ?? null,
      setItem: (k: string, v: string) => void items.set(k, v),
      removeItem: (k: string) => void items.delete(k),
    } as unknown as Storage;
    writeItem(fake, "k", "1.2.3");
    expect(readItem(fake, "k")).toBe("1.2.3");
    writeItem(fake, "k", null);
    expect(readItem(fake, "k")).toBeNull();
    expect(readItem(null, "k")).toBeNull();
    const broken = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    } as unknown as Storage;
    expect(readItem(broken, "k")).toBeNull();
    expect(() => writeItem(broken, "k", "x")).not.toThrow();
  });
});
