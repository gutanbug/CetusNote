import { createExtensions } from "@/components/editor/extensions";
import { getSchema } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { msg, setLocale } from "@/lib/i18n";
import { TEMPLATE_CATEGORIES, TEMPLATES, todayISO } from "./templates";

describe("내장 템플릿 (PAGE-07)", () => {
  const schema = getSchema(createExtensions());

  it("모든 템플릿 본문이 에디터 스키마에 맞는다", () => {
    for (const t of TEMPLATES) {
      const made = t.make("2026-11-19");
      expect(() => schema.nodeFromJSON(made.content).check(), t.id).not.toThrow();
    }
  });

  it("분류마다 템플릿이 있고, id는 겹치지 않는다", () => {
    for (const c of TEMPLATE_CATEGORIES)
      expect(
        TEMPLATES.some((t) => t.category === c.id),
        c.id,
      ).toBe(true);
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
  });

  it("날짜가 들어가는 템플릿은 제목에 오늘 날짜를 쓴다", () => {
    expect(TEMPLATES.find((t) => t.id === "meeting")!.make("2026-11-19").title).toBe(
      "회의록 2026-11-19",
    );
    expect(todayISO(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("영어로 보면 영어 이름과 제목으로 만든다 (SYS-14)", () => {
    setLocale("en");
    try {
      const meeting = TEMPLATES.find((t) => t.id === "meeting")!;
      expect(meeting.name).toBe("Meeting notes");
      expect(meeting.make("2026-11-19").title).toBe("Meeting notes 2026-11-19");
      expect(msg().features.templates.categories.work).toBe("Work");
    } finally {
      setLocale("ko");
    }
  });
});
