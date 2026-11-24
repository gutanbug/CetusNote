import { describe, expect, it } from "vitest";
import {
  File,
  FileArchive,
  FileCode,
  FileImage,
  FileMusic,
  FileSpreadsheet,
  FileText,
  FileVideoCamera,
  Presentation,
} from "lucide-react";
import { attachmentIcon } from "./attachment-icon";

describe("첨부 아이콘 (attachmentIcon)", () => {
  it("확장자별 묶음", () => {
    expect(attachmentIcon("회의록.docx")).toBe(FileText);
    expect(attachmentIcon("예산.xlsx")).toBe(FileSpreadsheet);
    expect(attachmentIcon("발표.pptx")).toBe(Presentation);
    expect(attachmentIcon("backup.zip")).toBe(FileArchive);
    expect(attachmentIcon("index.TSX")).toBe(FileCode);
    expect(attachmentIcon("사진.HEIC")).toBe(FileImage);
  });

  it("PDF와 영상·소리는 MIME·종류가 우선", () => {
    expect(attachmentIcon("a.pdf", "application/pdf")).toBe(FileText);
    expect(attachmentIcon("clip.bin", "video/webm")).toBe(FileVideoCamera);
    expect(attachmentIcon("song.bin", "audio/wav")).toBe(FileMusic);
    expect(attachmentIcon("lecture.mp4")).toBe(FileVideoCamera);
  });

  it("모르는 확장자는 일반 파일", () => {
    expect(attachmentIcon("data.weird")).toBe(File);
    expect(attachmentIcon("noext")).toBe(File);
  });
});
