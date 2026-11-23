import { describe, expect, it } from "vitest";
import { formatAgo, formatDate } from "./format-date";

describe("날짜 문구", () => {
  const now = new Date("2026-11-19T12:00:00");
  it("지난 시간", () => {
    expect(formatAgo("2026-11-19T11:59:40", now)).toBe("방금");
    expect(formatAgo("2026-11-19T11:55:00", now)).toBe("5분 전");
    expect(formatAgo("2026-11-19T09:00:00", now)).toBe("3시간 전");
    expect(formatAgo("2026-11-17T12:00:00", now)).toBe("2일 전");
    expect(formatAgo("2026-11-01T12:00:00", now)).toBe("2026년 11월 1일");
  });
  it("날짜와 잘못된 값", () => {
    expect(formatDate("2026-11-19T09:00:00")).toBe("2026년 11월 19일");
    expect(formatAgo("엉뚱한 값", now)).toBe("");
  });
});
