import { fn } from "storybook/test";
import samplePdf from "@/debug/samples/sample-notes.pdf?url";
import sampleClip from "@/debug/samples/sample-clip.webm?url";
import sampleTone from "@/debug/samples/sample-tone.wav?url";
import type { JSONContent } from "@tiptap/core";
import type { AttachmentPick, AttachmentPickKind, AttachmentSource } from "./attachment";

/**
 * 첨부 블록 스토리의 견본 (EDIT-31~33). 스토리 파일이 같이 쓴다.
 * 저장 계층 대신 가짜 첨부 저장소를 넘긴다. GONE 경로는 누락 파일이다.
 */

export const OWNER = "01JD0000000000000000000001";
export const PDF = `assets/${OWNER}/01JD0000000000000000000002-notes.pdf`;
export const VIDEO = `assets/${OWNER}/01JD0000000000000000000003-clip.webm`;
export const AUDIO = `assets/${OWNER}/01JD0000000000000000000004-tone.wav`;
export const DOC = `assets/${OWNER}/01JD0000000000000000000005-report.docx`;
export const GONE = `assets/${OWNER}/01JD0000000000000000000006-old.pdf`;

/** 견본 경로 → 웹뷰 주소 */
const FILES: Record<string, string> = {
  [PDF]: samplePdf,
  [VIDEO]: sampleClip,
  [AUDIO]: sampleTone,
  [DOC]: samplePdf,
};

/** 고르기 결과 (종류마다 하나) */
export const PICKS: Record<AttachmentPickKind, AttachmentPick | null> = {
  file: { path: DOC, name: "보고서.docx", size: 20480, mime: "", kind: "file" },
  pdf: { path: PDF, name: "회의 메모.pdf", size: 1394, mime: "application/pdf", kind: "pdf" },
  media: { path: AUDIO, name: "소리.wav", size: 48078, mime: "audio/wav", kind: "audio" },
};

export function fakeSource(overrides: Partial<AttachmentSource> = {}): AttachmentSource {
  return {
    resolve: (path) =>
      path === GONE
        ? Promise.reject(new Error("없는 파일"))
        : Promise.resolve(FILES[path] ?? samplePdf),
    pick: fn(async (kind: AttachmentPickKind) => PICKS[kind]),
    importFile: fn(async () => null),
    open: fn(),
    reveal: fn(),
    saveAs: fn(),
    ...overrides,
  };
}

/** 첨부 블록 네 종류 + 누락 파일 하나 */
export const blocks: JSONContent = {
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: "첨부 블록 견본" }] },
    {
      type: "attachment",
      attrs: {
        path: PDF,
        name: "회의 메모.pdf",
        size: 1394,
        mime: "application/pdf",
        kind: "pdf",
        caption: "",
      },
    },
    {
      type: "attachment",
      attrs: {
        path: VIDEO,
        name: "샘플 영상.webm",
        size: 14723,
        mime: "video/webm",
        kind: "video",
        caption: "첫 장면",
      },
    },
    {
      type: "attachment",
      attrs: {
        path: AUDIO,
        name: "소리.wav",
        size: 48078,
        mime: "audio/wav",
        kind: "audio",
        caption: "",
      },
    },
    {
      type: "attachment",
      attrs: { path: DOC, name: "보고서.docx", size: 20480, mime: "", kind: "file", caption: "" },
    },
    {
      type: "attachment",
      attrs: {
        path: GONE,
        name: "지운 파일.pdf",
        size: 900,
        mime: "application/pdf",
        kind: "pdf",
        caption: "",
      },
    },
    { type: "paragraph" },
  ],
};

export const empty: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };
