/* i18n-ignore-file — 한국어 시간 표현 테스트 */
import { describe, expect, it } from "vitest";
import { parseReminderText } from "./reminder-parse";

// 기준 시각: 2026-11-27(금) 10:00, 지역 시간
const NOW = new Date(2026, 10, 27, 10, 0, 0);

const alarmAt = (input: string) => parseReminderText(input, NOW).when;

describe("parseReminderText: 타이머(길이)", () => {
  it.each([
    ["10분 타이머", 600, ""],
    ["25분", 1500, ""],
    ["30분 뒤 타이머", 1800, ""],
    ["2시간 뒤 타이머", 7200, ""],
    ["in 30 minutes", 1800, ""],
    ["in 1h", 3600, ""],
    ["in 1 hour 30 minutes", 5400, ""],
    ["25 min timer", 1500, ""],
    ["in 15 mins take a break", 900, "take a break"],
  ])("%s → %i초", (input, sec, label) => {
    const r = parseReminderText(input, NOW);
    expect(r.when).toEqual({ kind: "timer", durationSec: sec });
    expect(r.label).toBe(label);
    expect(r.span).not.toBeNull();
  });
});

describe("parseReminderText: 상대 시각 「N분 뒤」는 알람(시계 시각)", () => {
  it.each([
    ["1분뒤에 알림줘", "2026-11-27T10:01", ""],
    ["1분 뒤에 알려줘", "2026-11-27T10:01", ""],
    ["1분 뒤에 알려 줘", "2026-11-27T10:01", ""],
    ["10분 후에 물 마시기", "2026-11-27T10:10", "물 마시기"],
    ["30분 뒤에 회의 준비 알려줘", "2026-11-27T10:30", "회의 준비"],
    ["30분 뒤 커피", "2026-11-27T10:30", "커피"],
    ["5분 뒤 전화하기", "2026-11-27T10:05", "전화하기"],
    ["1시간 30분 후 회의", "2026-11-27T11:30", "회의"],
    ["2시간 뒤", "2026-11-27T12:00", ""],
    ["내일 9시에 보고서", "2026-11-28T09:00", "보고서"],
    ["3시에 회의", "2026-11-27T15:00", "회의"],
    ["10분 뒤에 remind me to stretch", "2026-11-27T10:10", "stretch"],
  ])("%s → %s, 이름 「%s」", (input, at, label) => {
    const r = parseReminderText(input, NOW);
    expect(r.when).toEqual({ kind: "alarm", at });
    expect(r.label).toBe(label);
    expect(r.span).not.toBeNull();
  });

  it("빈 이름은 빈 문자열로 돌려준다 (기본 이름 「알림」은 화면이 정한다)", () => {
    expect(parseReminderText("1분뒤에 알림줘", NOW).label).toBe("");
  });
});

describe("parseReminderText: 알람(한 번)", () => {
  it.each([
    ["오늘 3시", "2026-11-27T15:00"],
    ["오후 3시 반 회의", "2026-11-27T15:30"],
    ["내일 9시", "2026-11-28T09:00"],
    ["모레 오전 10시", "2026-11-29T10:00"],
    ["12월 3일 14:00", "2026-12-03T14:00"],
    ["다음 주 월요일 9시", "2026-11-30T09:00"],
    ["금요일 오후 2시", "2026-11-27T14:00"],
    ["금요일 오전 9시", "2026-12-04T09:00"],
    ["3시", "2026-11-27T15:00"],
    ["9시 회의", "2026-11-28T09:00"],
    ["12시 점심", "2026-11-27T12:00"],
    ["오후 11시 30분 취침", "2026-11-27T23:30"],
    ["at 3pm", "2026-11-27T15:00"],
    ["tomorrow 9am", "2026-11-28T09:00"],
    ["next monday 9:00", "2026-11-30T09:00"],
    ["Dec 3 14:00", "2026-12-03T14:00"],
  ])("%s → %s", (input, at) => {
    const w = alarmAt(input);
    expect(w).toEqual({ kind: "alarm", at });
  });

  it("keeps the label without the time phrase and a trailing particle", () => {
    expect(parseReminderText("내일 오후 3시 반에 메일", NOW).label).toBe("메일");
    expect(parseReminderText("금요일 오후 2시에 보고서 제출", NOW).label).toBe("보고서 제출");
    expect(parseReminderText("내일 9시 회의 준비", NOW).label).toBe("회의 준비");
  });
});

describe("parseReminderText: 반복", () => {
  it.each([
    ["매일 9시", "2026-11-28T09:00", "day"],
    ["평일 8시 30분", "2026-11-30T08:30", "weekday"],
    ["매주 월요일 10시", "2026-11-30T10:00", "week"],
    ["매월 1일 9시", "2026-12-01T09:00", "month"],
    ["every day at 9", "2026-11-28T09:00", "day"],
    ["weekdays 8:30", "2026-11-30T08:30", "weekday"],
    ["every monday 10am", "2026-11-30T10:00", "week"],
    ["monthly on the 1st 9am", "2026-12-01T09:00", "month"],
  ])("%s → %s (%s)", (input, at, repeat) => {
    expect(alarmAt(input)).toEqual({ kind: "alarm", at, repeat });
  });

  it("repeat with a time still ahead today starts today", () => {
    expect(alarmAt("매일 오후 6시")).toEqual({
      kind: "alarm",
      at: "2026-11-27T18:00",
      repeat: "day",
    });
  });
});

describe("parseReminderText: 위치와 못 알아들을 때", () => {
  it("span covers the matched phrase in the input", () => {
    const input = "내일 9시 회의";
    expect(parseReminderText(input, NOW).span).toEqual([0, "내일 9시".length]);
    const timer = "회의 중 30분 뒤 커피";
    const r = parseReminderText(timer, NOW);
    expect(timer.slice(r.span![0], r.span![1])).toBe("30분 뒤");
  });

  it("returns no when and the whole text as label when nothing matches", () => {
    expect(parseReminderText("hello world", NOW)).toEqual({
      label: "hello world",
      when: null,
      span: null,
    });
    expect(parseReminderText("  그냥 메모  ", NOW)).toEqual({
      label: "그냥 메모",
      when: null,
      span: null,
    });
  });

  it("a bare weekday with no time is not an alarm", () => {
    expect(parseReminderText("tomorrow", NOW).when).toBeNull();
    expect(parseReminderText("금요일 보고서", NOW).when).toBeNull();
  });

  it("rejects impossible dates", () => {
    expect(parseReminderText("2월 30일 9시", NOW).when).toBeNull();
  });
});
