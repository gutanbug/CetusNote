import { describe, expect, it } from "vitest";
import { collectReminders } from "./collect-reminders";

const chip = (attrs: Record<string, unknown>) => ({ type: "dateChip", attrs });

describe("collectReminders", () => {
  it("알림이 켜진 날짜 칩만 문서 순서대로 모은다", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            chip({
              date: "2026-12-01",
              time: "09:30",
              reminder: { kind: "custom", time: "09:30" },
            }),
            chip({ date: "2026-12-02", reminder: { kind: "none" } }),
          ],
        },
        {
          type: "toggleHeading",
          attrs: { open: true },
          content: [
            {
              type: "heading",
              attrs: { level: 2 },
              content: [chip({ date: "2026-12-03", reminder: { kind: "morning" }, done: true })],
            },
          ],
        },
      ],
    };
    expect(collectReminders(doc, "p1")).toEqual([
      {
        pageId: "p1",
        date: "2026-12-01",
        time: "09:30",
        rule: { kind: "custom", time: "09:30" },
        done: false,
      },
      { pageId: "p1", date: "2026-12-03", time: null, rule: { kind: "morning" }, done: true },
    ]);
  });

  it("알림 속성이 없거나 깨졌으면 알림 없음으로 본다", () => {
    expect(
      collectReminders(
        { content: [chip({ date: "2026-12-01" }), chip({ date: "2026-12-01", reminder: "bad" })] },
        "p",
      ),
    ).toEqual([]);
  });

  it("날짜 칩이 없는 문서는 빈 목록", () => {
    expect(
      collectReminders(
        { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "x" }] }] },
        "p",
      ),
    ).toEqual([]);
  });
});
