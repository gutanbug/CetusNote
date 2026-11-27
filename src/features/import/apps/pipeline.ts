import { msg } from "@/lib/i18n";
import type { AppImportPick } from "@/lib/storage";
import { convertMarkdownTree, convertNotion } from "./notion";
import { convertObsidianVault } from "./obsidian";
import { IMPORT_GUIDES, type ImportGuide } from "./guides";
import type { ImportNode, SourceFile } from "./tree";

/** 다른 앱에서 가져오기(DATA-11)가 다루는 앱. 목록과 안내는 guides.ts가 원천이다 */
export const IMPORT_APPS = IMPORT_GUIDES;

export type ImportAppId = ImportGuide["id"];

export function appLabel(app: ImportAppId): string {
  return IMPORT_APPS.find((a) => a.id === app)!.label;
}

export type ParseOutcome = {
  nodes: ImportNode[];
  /** 읽지 못한 항목 이름 */
  skipped: string[];
  /** 사용자에게 보여 줄 오류(고른 것이 이 앱의 내보내기가 아닐 때). 있으면 nodes는 비어 있다 */
  error: string | null;
  /** 리소스 바이트(키 `enex/<md5>`). ENEX만 쓴다 */
  blobs?: Map<string, Uint8Array>;
};

const DOC = /\.(md|markdown|html?|htm)$/i;

/**
 * 고른 zip·폴더의 목록을 앱별 항목 목록으로 바꾼다 (순수 함수).
 * 이 앱의 내보내기가 아니면 error에 해요체 안내를 담는다.
 */
export function parseAppExport(app: ImportAppId, pick: AppImportPick): ParseOutcome {
  const files: SourceFile[] = pick.texts.map((t) => ({ path: t.path, text: t.text }));
  const docs = pick.paths.filter((p) => DOC.test(p));
  const native = pick.paths.some((p) => /\.(bs|affine)$/i.test(p));
  if (app === "affine" && native && !docs.length) {
    return {
      nodes: [],
      skipped: [],
      error: msg().features.import.affineOriginal,
    };
  }
  if (!docs.length) {
    return { nodes: [], skipped: [], error: notFoundMessage(app) };
  }
  let result;
  switch (app) {
    case "notion":
      result = convertNotion(files);
      break;
    case "obsidian":
      result = convertObsidianVault(files, pick.paths);
      break;
    case "appflowy":
    case "affine":
      result = convertMarkdownTree(files);
      break;
    case "evernote":
      return {
        nodes: [],
        skipped: [],
        error: msg().features.import.evernoteUseEnex,
      };
  }
  return { nodes: result.nodes, skipped: [...result.skipped, ...pick.skipped], error: null };
}

function notFoundMessage(app: ImportAppId): string {
  switch (app) {
    case "notion":
      return msg().features.import.notFound.notion;
    case "obsidian":
      return msg().features.import.notFound.obsidian;
    case "appflowy":
      return msg().features.import.notFound.appflowy;
    case "affine":
      return msg().features.import.notFound.affine;
    case "evernote":
      return msg().features.import.notFound.evernote;
  }
}
