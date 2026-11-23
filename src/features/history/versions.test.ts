import type { PageVersion } from "@/lib/storage";
import { describe, expect, it } from "vitest";
import { dayLabel, groupVersions, relativeTime } from "./versions";

/** 지역 시각으로 만든 Date (테스트가 어느 시간대에서 돌아도 같은 결과) */
const local = (y: number, mo: number, d: number, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi);
const ver = (id: string, date: Date, chars = 0): PageVersion => ({
  id,
  savedAt: date.toISOString(),
  size: 1,
  chars,
});

describe("version list labels", () => {
  const now = local(2026, 11, 21, 15, 0);

  it("names days as 오늘 · 어제 · date", () => {
    expect(dayLabel(local(2026, 11, 21, 1), now)).toBe("오늘");
    expect(dayLabel(local(2026, 11, 20, 23), now)).toBe("어제");
    expect(dayLabel(local(2026, 11, 18), now)).toBe("11월 18일");
    expect(dayLabel(local(2025, 12, 31), now)).toBe("2025년 12월 31일");
  });

  it("gives a short relative time", () => {
    expect(relativeTime(local(2026, 11, 21, 14, 59), now)).toBe("1분 전");
    expect(relativeTime(new Date(now.getTime() - 30_000), now)).toBe("방금 전");
    expect(relativeTime(local(2026, 11, 21, 12, 0), now)).toBe("3시간 전");
    expect(relativeTime(local(2026, 11, 18, 15, 0), now)).toBe("3일 전");
  });

  it("groups consecutive versions by day and formats time and characters", () => {
    const groups = groupVersions(
      [
        ver("c", local(2026, 11, 21, 14, 5), 1234),
        ver("b", local(2026, 11, 21, 9, 30), 12),
        ver("a", local(2026, 11, 20, 23, 50), 0),
      ],
      now,
    );
    expect(groups.map((g) => g.label)).toEqual(["오늘", "어제"]);
    expect(groups[0].rows[0]).toEqual({
      id: "c",
      time: "14:05",
      relative: "55분 전",
      chars: "1,234자",
    });
    expect(groups[0].rows).toHaveLength(2);
    expect(groups[1].rows[0].time).toBe("23:50");
  });

  it("skips versions whose time cannot be read", () => {
    const groups = groupVersions(
      [{ id: "x", savedAt: "not a date", size: 1, chars: 0 }, ver("y", local(2026, 11, 21, 1))],
      now,
    );
    expect(groups.flatMap((g) => g.rows.map((r) => r.id))).toEqual(["y"]);
  });
});
