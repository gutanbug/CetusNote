import { afterEach, describe, expect, it } from "vitest";
import { messagesFor, setLocale } from "@/lib/i18n";
import { filterSlashItems, SLASH_ITEMS, slashGroupId } from "./slash-items";

afterEach(() => setLocale("ko"));

describe("슬래시 메뉴 다국어 (SYS-14)", () => {
  it("영어 화면에서는 영어 이름과 그룹 이름을 쓴다", () => {
    setLocale("en");
    const heading = SLASH_ITEMS.find((it) => it.id === "heading1")!;
    expect(heading.title).toBe("Heading 1");
    expect(heading.description).toBe("Largest section heading");
    const media = messagesFor("en").editor.slash.groups[slashGroupId("미디어")];
    expect(media).toBe("Media");
  });

  it("한국어·영어 검색 별칭은 어느 언어 화면에서든 맞는다", () => {
    for (const locale of ["ko", "en"] as const) {
      setLocale(locale);
      expect(filterSlashItems("헤딩").map((it) => it.id)).toContain("heading1");
      expect(filterSlashItems("heading").map((it) => it.id)).toContain("heading1");
      expect(filterSlashItems("checklist").map((it) => it.id)).toContain("taskList");
      expect(filterSlashItems("체크").map((it) => it.id)).toContain("taskList");
    }
  });
});
