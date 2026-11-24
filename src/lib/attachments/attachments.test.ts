import { describe, expect, it } from "vitest";
import { formatBytes, formatLabel, formatTime, middleEllipsis } from "./format";
import {
  FILE_MAX_BYTES,
  MEDIA_MAX_BYTES,
  attachmentKind,
  extensionOf,
  isOversize,
  limitFor,
  oversizeMessage,
} from "./limits";

describe("첨부 종류 (attachmentKind)", () => {
  it("MIME 형식을 먼저 본다", () => {
    expect(attachmentKind("a.bin", "application/pdf")).toBe("pdf");
    expect(attachmentKind("clip.dat", "video/mp4")).toBe("video");
    expect(attachmentKind("memo.dat", "audio/mpeg")).toBe("audio");
    expect(attachmentKind("a.pdf", "text/plain")).toBe("file");
  });

  it("MIME이 없으면 확장자로 정한다 (대소문자 무시)", () => {
    expect(attachmentKind("Report.PDF", null)).toBe("pdf");
    expect(attachmentKind("lecture.MOV")).toBe("video");
    expect(attachmentKind("podcast.m4a", "")).toBe("audio");
    expect(attachmentKind("archive.zip")).toBe("file");
    expect(attachmentKind("README")).toBe("file");
  });
});

describe("크기 상한 (limits)", () => {
  it("파일 25MB, 영상·소리 200MB", () => {
    expect(FILE_MAX_BYTES).toBe(25 * 1024 * 1024);
    expect(MEDIA_MAX_BYTES).toBe(200 * 1024 * 1024);
    expect(limitFor("file")).toBe(FILE_MAX_BYTES);
    expect(limitFor("pdf")).toBe(FILE_MAX_BYTES);
    expect(limitFor("video")).toBe(MEDIA_MAX_BYTES);
    expect(limitFor("audio")).toBe(MEDIA_MAX_BYTES);
  });

  it("상한과 같은 크기는 넘지 않은 것", () => {
    expect(isOversize("pdf", FILE_MAX_BYTES)).toBe(false);
    expect(isOversize("pdf", FILE_MAX_BYTES + 1)).toBe(true);
    expect(isOversize("video", FILE_MAX_BYTES + 1)).toBe(false);
    expect(isOversize("video", MEDIA_MAX_BYTES + 1)).toBe(true);
    expect(isOversize("file", undefined)).toBe(false);
  });

  it("초과 안내 문구", () => {
    expect(oversizeMessage("file")).toBe("파일이 너무 커요 (최대 25MB)");
    expect(oversizeMessage("video")).toBe("영상·소리 파일이 너무 커요 (최대 200MB)");
  });
});

describe("확장자 · 형식 표시", () => {
  it("확장자는 소문자로, 점이 없거나 숨김 파일이면 빈 값", () => {
    expect(extensionOf("Notes.Final.DOCX")).toBe("docx");
    expect(extensionOf("README")).toBe("");
    expect(extensionOf(".env")).toBe("");
    expect(extensionOf("trailing.")).toBe("");
  });

  it("형식 라벨: 대문자 확장자, 없으면 파일", () => {
    expect(formatLabel("회의록.pdf")).toBe("PDF");
    expect(formatLabel("data.tar.gz")).toBe("GZ");
    expect(formatLabel("noext")).toBe("파일");
  });
});

describe("크기 표시 (formatBytes)", () => {
  it("단위별 표시", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(3.4 * 1024)).toBe("3.4 KB");
    expect(formatBytes(12 * 1024 * 1024)).toBe("12 MB");
    expect(formatBytes(1.25 * 1024 ** 3)).toBe("1.3 GB");
    expect(formatBytes(2 * 1024 ** 4)).toBe("2 TB");
  });

  it("잘못된 값은 빈 문자열", () => {
    expect(formatBytes(-1)).toBe("");
    expect(formatBytes(Number.NaN)).toBe("");
  });
});

describe("긴 이름 줄이기 (middleEllipsis)", () => {
  it("max 이하는 그대로", () => {
    expect(middleEllipsis("short.pdf", 20)).toBe("short.pdf");
  });

  it("가운데를 줄이고 짧은 확장자는 살린다", () => {
    const name = "회의록_최종_검토의견_반영본_2026년_11월_3주차.pdf";
    const out = middleEllipsis(name, 24);
    expect(Array.from(out)).toHaveLength(24);
    expect(out).toContain("…");
    expect(out.endsWith(".pdf")).toBe(true);
    expect(out.startsWith("회의록")).toBe(true);
  });

  it("확장자 없이도 max 글자로 줄인다 (코드 포인트 기준)", () => {
    const out = middleEllipsis("가나다라마바사아자차카타파하".repeat(3), 10);
    expect(Array.from(out)).toHaveLength(10);
  });

  it("아주 짧은 max에서는 확장자를 버린다", () => {
    expect(Array.from(middleEllipsis("abcdefghijk.pdf", 6))).toHaveLength(6);
  });
});

describe("재생 시간 (formatTime)", () => {
  it("분:초, 시간이 있으면 시:분:초", () => {
    expect(formatTime(5)).toBe("0:05");
    expect(formatTime(187.9)).toBe("3:07");
    expect(formatTime(3730)).toBe("1:02:10");
  });

  it("음수·NaN·무한대는 0:00", () => {
    expect(formatTime(-3)).toBe("0:00");
    expect(formatTime(Number.NaN)).toBe("0:00");
    expect(formatTime(Number.POSITIVE_INFINITY)).toBe("0:00");
  });
});
