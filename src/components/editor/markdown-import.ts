import { getSchema, type JSONContent } from "@tiptap/core";
import { DOMParser as PMDOMParser, type Schema } from "@tiptap/pm/model";
import { normalizeDocCodeLanguages } from "@/lib/code-language";
import { createExtensions } from "./extensions";
import { markdownToDom } from "./markdown-paste";
import { imagesToFigures } from "./remote-images";

/** 한 파일에서 가져오는 이미지 수 (웹 주소 + 상대 경로 + 안에 든 그림) */
export const MAX_IMPORT_IMAGES = 100;

/** 그림 한 개의 바이트를 페이지 assets로 옮기고 `assets/…` 경로를 돌려준다. 못 하면 throw */
export type ImageResolver = (src: string) => Promise<string>;

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
  resolveImage?: ImageResolver,
  pageLabel?: (id: string) => string | undefined,
): Promise<JSONContent> {
  return bodyToDoc(
    markdownToDom(text, { local: true, max: MAX_IMPORT_IMAGES }, { pageLabel }),
    resolveImage,
  );
}

/**
 * HTML 글(.html · .docx 변환 결과 · .txt · .pdf 글) → 문서 (DATA-08).
 * 스크립트·스타일·폼·이벤트 속성·위험한 주소는 버린다. 제목은 `<title>`, 없으면 첫 `<h1>`
 * (그 h1은 본문에서 뺀다). 제목이 없으면 title은 null이고, 호출하는 쪽이 파일 이름을 쓴다.
 * 그림은 Markdown과 같은 규칙(상대 경로·data URL은 resolveImage, 웹 주소는 내려받기)을 따른다.
 */
export async function htmlToDoc(
  html: string,
  resolveImage?: ImageResolver,
): Promise<{ title: string | null; doc: JSONContent }> {
  const parsed = new window.DOMParser().parseFromString(html, "text/html");
  const body = parsed.body;
  sanitizeBody(body);
  let title = parsed.querySelector("title")?.textContent?.trim() || null;
  const h1 = body.querySelector("h1");
  if (!title && h1) {
    title = h1.textContent?.trim() || null;
    h1.remove();
  }
  imagesToFigures(body, { local: true, max: MAX_IMPORT_IMAGES });
  const doc = await bodyToDoc(body, resolveImage);
  return { title: title ? title.slice(0, 200) : null, doc };
}

/** 가져온 HTML에서 실행되거나 밖으로 나가는 것을 지운다. 문서 스키마에 없는 태그는 파서가 버린다 */
const DROP =
  "script,style,iframe,frame,frameset,object,embed,link,meta,base,form,input,button,select,textarea,noscript,template,svg,math,canvas,video,audio";
/** 링크는 웹·메일·전화만 살린다 (javascript:, data:, 상대 주소 등은 글자만 남긴다) */
const SAFE_HREF = /^(https?:|mailto:|tel:)/i;

function sanitizeBody(body: HTMLElement): void {
  for (const el of body.querySelectorAll(DROP)) el.remove();
  for (const el of body.querySelectorAll("*")) {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on") || name === "style" || name === "srcdoc")
        el.removeAttribute(attr.name);
      else if (name === "href" && !SAFE_HREF.test(attr.value.trim())) el.removeAttribute(attr.name);
    }
  }
}

/**
 * 그림 자리(`figure[data-local]`, data URL `figure[data-remote^="data:"]`)를 resolveImage로 옮긴다.
 * 못 옮긴 그림은 캡션 글(없으면 빈 것)로 남기고, 빈 문단은 지운다.
 */
async function bodyToDoc(body: HTMLElement, resolveImage?: ImageResolver): Promise<JSONContent> {
  for (const figure of body.querySelectorAll<HTMLElement>(
    'figure[data-local], figure[data-remote^="data:"]',
  )) {
    const src = figure.getAttribute("data-local") ?? figure.getAttribute("data-remote")!;
    figure.removeAttribute("data-local");
    figure.removeAttribute("data-remote");
    try {
      if (!resolveImage) throw new Error("no resolver");
      figure.setAttribute("data-src", await resolveImage(src));
    } catch {
      const p = figure.ownerDocument.createElement("p");
      // data URL은 긴 글이 되므로 경로 글로 남기지 않는다
      p.textContent = figure.textContent?.trim() || (src.startsWith("data:") ? "" : src);
      figure.replaceWith(p);
    }
  }
  // 지운 이미지가 남긴 빈 문단 (마크다운에는 일부러 빈 문단이 없다)
  for (const p of body.querySelectorAll("p"))
    if (!p.textContent?.trim() && !p.querySelector("img, br")) p.remove();
  const doc = PMDOMParser.fromSchema(editorSchema()).parse(body).toJSON() as JSONContent;
  // 코드 블록 언어 별칭(`ts` → `typescript`)은 붙여넣기와 같은 이름으로 저장한다
  return normalizeDocCodeLanguages(doc);
}
