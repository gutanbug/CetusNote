import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { toast } from "@/components/ui/toast";

/** 한 번 붙여넣기에서 내려받을 웹 이미지 수 — 넘는 것은 버린다 */
export const MAX_PASTED_IMAGES = 20;
/** 이 크기 이하로 적힌 이미지는 추적용 픽셀로 보고 버린다 */
const TINY_PX = 2;

const HTTP = /^https?:\/\//i;
const DATA_IMAGE = /^data:image\/(png|jpe?g|gif|webp);base64,/i;
/** 스킴(`file:` `javascript:` …)도 `//`·`/`로 시작하지도 않는 상대 경로 */
const RELATIVE = /^(?![a-z][a-z0-9+.-]*:|\/)[^\s]+$/i;

/** 이미지 하나만 감싼 채 벗겨도 되는 태그 */
const WRAPPERS = new Set(["P", "A", "SPAN", "PICTURE", "FIGURE", "DIV", "B", "STRONG", "I", "EM"]);

/** el 안에 child 말고는 공백·<source>뿐인지 */
function onlyChild(el: Element, child: Element): boolean {
  return [...el.childNodes].every(
    (n) =>
      n === child ||
      (n.nodeType === Node.TEXT_NODE && !n.textContent?.trim()) ||
      (n instanceof Element && (n.tagName === "SOURCE" || n.tagName === "FIGCAPTION")),
  );
}

type Download = {
  fetch: ((url: string) => Promise<string>) | null;
  upload: ((file: File) => Promise<string>) | null;
};

/**
 * 붙여 넣은 HTML의 `<img>`를 내려받을 이미지 블록 자리(`figure[data-remote]`)로 바꾼다.
 * http·https · data:image(png·jpeg·gif·webp)만, 붙여넣기 한 번에 MAX_PASTED_IMAGES개까지.
 * alt는 캡션이 된다. 나머지 `<img>`는 지운다(스키마에 없어 원래도 버려졌다).
 * `local`(Markdown 가져오기, DATA-08): 상대 경로(`img/a.png`)도 `figure[data-local]` 자리로 남긴다 —
 * 가져오는 쪽이 파일을 읽어 `data-src`로 바꾼다. `max`로 개수 한도를 바꾼다.
 */
export function imagesToFigures(
  root: ParentNode & Node,
  { local = false, max = MAX_PASTED_IMAGES }: { local?: boolean; max?: number } = {},
): void {
  const doc = root.ownerDocument ?? (root as Document);
  let n = 0;
  for (const img of root.querySelectorAll("img")) {
    const src = (img.getAttribute("src") ?? "").trim();
    const w = Number(img.getAttribute("width"));
    const h = Number(img.getAttribute("height"));
    const tiny = (w > 0 && w <= TINY_PX) || (h > 0 && h <= TINY_PX);
    const relative = local && RELATIVE.test(src);
    if (tiny || n >= max || !(HTTP.test(src) || DATA_IMAGE.test(src) || relative)) {
      img.remove();
      continue;
    }
    n++;
    const figure = doc.createElement("figure");
    figure.setAttribute("data-type", "image");
    figure.setAttribute(relative ? "data-local" : "data-remote", src);
    // 이미지만 감싼 껍데기(<p><img></p>, <a><img></a>, <picture> …)는 벗긴다 — 블록이
    // 문단·링크 안에 들어가면 파서가 문단을 쪼개 앞뒤에 빈 문단이 남는다
    let target: Element = img;
    while (
      target.parentElement &&
      WRAPPERS.has(target.parentElement.tagName) &&
      onlyChild(target.parentElement, target)
    )
      target = target.parentElement;
    // 캡션: 웹 <figcaption>이 있으면 그것, 없으면 alt
    const caption = doc.createElement("figcaption");
    const webCaption = target.tagName === "FIGURE" ? target.querySelector("figcaption") : null;
    caption.textContent = (webCaption?.textContent || img.getAttribute("alt") || "").trim();
    figure.append(caption);
    target.replaceWith(figure);
  }
}

/** 붙여넣기 HTML 변환. 이미지가 없으면 그대로 (화면 밖 문서에서 읽어 이미지를 불러오지 않는다) */
export function transformPastedImages(html: string): string {
  if (!/<img\b/i.test(html)) return html;
  const doc = new window.DOMParser().parseFromString(html, "text/html");
  imagesToFigures(doc.body);
  return doc.body.innerHTML;
}

function dataUrlToFile(url: string): File {
  const [head, b64 = ""] = url.split(",", 2);
  const type = /^data:([^;]+)/.exec(head!)?.[1] ?? "image/png";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], "pasted", { type });
}

/** 내려받을 이미지 블록들 (원래 주소 → 위치) */
function pending(doc: PMNode, url?: string) {
  const out: { pos: number; node: PMNode }[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === "image") {
      if (!node.attrs.src && node.attrs.remote && (!url || node.attrs.remote === url))
        out.push({ pos, node });
      return false;
    }
    return !node.isTextblock;
  });
  return out;
}

const key = new PluginKey("remoteImages");

/**
 * 웹 글을 붙여 넣으면 그 안의 이미지를 내려받아 페이지 assets에 저장한다(EDIT-24).
 * 내려받는 동안은 "가져오는 중" 자리, 끝나면 경로를 넣는다. 실패하면 원래 주소의 링크로 남긴다.
 * 내려받기 결과는 실행 취소 기록에 넣지 않는다 — 실행 취소 한 번이면 붙여넣기 전으로.
 */
/** 내려받을 수 있는 주소인지 (http·https · data:image) — 붙여 넣은 figure[data-remote]도 여기서 거른다 */
export function isFetchableImage(url: unknown): url is string {
  return typeof url === "string" && (HTTP.test(url) || DATA_IMAGE.test(url));
}

export function remoteImagesPlugin({ fetch, upload }: Download) {
  const download = (url: string): Promise<string> => {
    if (!isFetchableImage(url)) return Promise.reject(new Error("지원하지 않는 주소"));
    if (DATA_IMAGE.test(url))
      return upload ? upload(dataUrlToFile(url)) : Promise.reject(new Error("저장소 없음"));
    return fetch ? fetch(url) : Promise.reject(new Error("내려받기 없음"));
  };

  return new Plugin({
    key,
    props: { transformPastedHTML: transformPastedImages },
    view(view: EditorView) {
      const inflight = new Set<string>();
      let alive = true;

      const finish = (url: string, src: string | null) => {
        inflight.delete(url);
        if (!alive) return;
        const { state } = view;
        const tr = state.tr;
        const link = state.schema.marks.link;
        for (const { pos, node } of pending(state.doc, url).reverse()) {
          if (src) {
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, src, remote: null });
          } else if (HTTP.test(url)) {
            // 실패: 캡션(없으면 "원본 이미지")을 원래 주소의 링크로 남긴다
            const text = state.schema.text(
              node.textContent || "원본 이미지",
              link ? [link.create({ href: url })] : [],
            );
            tr.replaceWith(
              pos,
              pos + node.nodeSize,
              state.schema.nodes.paragraph!.create(null, text),
            );
          } else {
            tr.delete(pos, pos + node.nodeSize);
          }
        }
        if (!tr.docChanged) return;
        view.dispatch(tr.setMeta("addToHistory", false));
        if (!src)
          toast("웹 이미지를 가져오지 못했어요", {
            id: "remote-image-failed",
            description: "원래 주소의 링크로 남겼어요.",
          });
      };

      const run = () => {
        if (!view.editable) return;
        for (const { node } of pending(view.state.doc)) {
          const url = node.attrs.remote as string;
          if (inflight.has(url)) continue;
          inflight.add(url);
          download(url).then(
            (src) => finish(url, src),
            () => finish(url, null),
          );
        }
      };

      // 저장된 문서에 남은 자리(내려받다 닫은 경우)도 이어서 받는다
      run();
      return {
        update: (v, prev) => {
          if (v.state.doc !== prev.doc) run();
        },
        destroy: () => {
          alive = false;
        },
      };
    },
  });
}
