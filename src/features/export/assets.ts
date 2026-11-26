import type { Page } from "@/lib/storage";
import { capUtf8Bytes } from "@/lib/utf8-cap";
import type { MdNode } from "./markdown";

/**
 * 단일 페이지 내보내기의 이미지·첨부 (DATA-04). 페이지가 쓰는 `assets/<id>/<파일>`을 모아,
 * 저장할 `assets/<이름>`을 정한다. 실제 복사는 Rust(`export_markdown`)가 한다.
 */

export type SingleAsset = { src: string; name: string };

/** 이름 한 조각의 UTF-8 바이트 상한(파일 시스템 255바이트 안). ` (99)` 같은 중복 번호 자리를 남긴다 */
const NAME_MAX_BYTES = 240;
const encoder = new TextEncoder();

const ASSET_SRC = /^assets\//;

/** 본문 이미지·첨부가 가리키는 워크스페이스 이미지를 등장 순서대로 모은다(같은 파일은 한 번만) */
export function pageAssetSrcs(content: MdNode | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const visit = (node: MdNode) => {
    const src =
      node.type === "image"
        ? node.attrs?.src
        : node.type === "attachment"
          ? node.attrs?.path
          : undefined;
    if (typeof src === "string" && ASSET_SRC.test(src) && !seen.has(src)) {
      seen.add(src);
      out.push(src);
    }
    for (const child of node.content ?? []) visit(child);
  };
  if (content) visit(content);
  return out;
}

/** 파일 이름 한 조각에서 금지 글자·제어 문자를 빼고 앞뒤 공백·앞의 점을 정리한다 */
function cleanName(name: string): string {
  return (
    name
      // eslint-disable-next-line no-control-regex
      .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^\.+/, "")
      .trim()
  );
}

/**
 * 이미지마다 `assets/` 안에서 겹치지 않는 이름을 정한다. 같은 이름이면 `이름 (2).png`처럼 붙인다.
 * 확장자는 지키고, 긴 이름은 앞부분(stem)을 줄인다.
 */
export function assignAssetNames(srcs: readonly string[]): SingleAsset[] {
  const used = new Set<string>();
  return srcs.map((src) => {
    const raw = cleanName(src.slice(src.lastIndexOf("/") + 1));
    const dot = raw.lastIndexOf(".");
    const ext = dot > 0 && raw.length - dot <= 16 ? raw.slice(dot) : "";
    const stemRaw = ext ? raw.slice(0, dot) : raw;
    const budget = NAME_MAX_BYTES - encoder.encode(ext).length;
    const stem = capUtf8Bytes(stemRaw, budget).trim() || "이미지";
    let name = `${stem}${ext}`;
    for (let n = 2; used.has(name.toLowerCase()); n++) name = `${stem} (${n})${ext}`;
    used.add(name.toLowerCase());
    return { src, name };
  });
}

/** 페이지의 이미지·첨부 목록(저장할 이름 포함) */
export function pageAssets(page: Pick<Page, "content">): SingleAsset[] {
  return assignAssetNames(pageAssetSrcs(page.content as MdNode | undefined));
}
