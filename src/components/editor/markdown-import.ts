import { getSchema, type JSONContent } from "@tiptap/core";
import { DOMParser as PMDOMParser, type Schema } from "@tiptap/pm/model";
import { normalizeLanguage } from "./code-block";
import { createExtensions } from "./extensions";
import { markdownToDom } from "./markdown-paste";

/** 한 파일에서 가져오는 이미지 수 (웹 주소 + 상대 경로) */
export const MAX_IMPORT_IMAGES = 100;

let schema: Schema | null = null;
/** 에디터와 같은 스키마 (처음 쓸 때 한 번 만든다) */
function editorSchema() {
  schema ??= getSchema(createExtensions());
  return schema;
}

/**
 * Markdown 글 → 문서(Tiptap JSON) (DATA-08). 붙여넣기(EDIT-23)와 같은 변환을 쓴다.
 * - 웹 이미지(`![](https://…)`)는 내려받을 자리로 남긴다 — 페이지를 열면 내려받는다(EDIT-24)
 * - 상대 경로 이미지는 resolveImage가 assets 경로로 바꾼다. 못 하면 캡션(없으면 경로) 글로 남긴다
 */
export async function markdownToDoc(
  text: string,
  resolveImage?: (src: string) => Promise<string>,
): Promise<JSONContent> {
  const body = markdownToDom(text, { local: true, max: MAX_IMPORT_IMAGES });
  for (const figure of body.querySelectorAll<HTMLElement>("figure[data-local]")) {
    const src = figure.getAttribute("data-local")!;
    figure.removeAttribute("data-local");
    try {
      if (!resolveImage) throw new Error("no resolver");
      figure.setAttribute("data-src", await resolveImage(src));
    } catch {
      const p = figure.ownerDocument.createElement("p");
      p.textContent = figure.textContent?.trim() || src;
      figure.replaceWith(p);
    }
  }
  // 지운 이미지가 남긴 빈 문단 (마크다운에는 일부러 빈 문단이 없다)
  for (const p of body.querySelectorAll("p"))
    if (!p.textContent?.trim() && !p.querySelector("img, br")) p.remove();
  const doc = PMDOMParser.fromSchema(editorSchema()).parse(body).toJSON() as JSONContent;
  normalizeCode(doc);
  return doc;
}

/** 코드 블록 언어 별칭(`ts` → `typescript`) — 붙여넣기와 같은 이름으로 저장한다 */
function normalizeCode(node: JSONContent) {
  if (node.type === "codeBlock" && node.attrs?.language)
    node.attrs = { ...node.attrs, language: normalizeLanguage(String(node.attrs.language)) };
  node.content?.forEach(normalizeCode);
}
