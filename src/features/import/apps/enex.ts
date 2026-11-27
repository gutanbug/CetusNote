import { msg } from "@/lib/i18n";
import type { ImportNode } from "./tree";
import { md5Hex } from "./md5";
import { escapeHtml, plainTextToHtml } from "../text";

/**
 * Evernote 내보내기(.enex, DATA-15) 변환. 파일 하나 = 노트북(폴더), <note> 하나 = 문서.
 * ENML(<en-note>)은 HTML 조각으로 바꿔 DATA-08 HTML 경로(htmlToDoc)로 넘긴다.
 * 그림·첨부는 리소스의 MD5로 찾아 blobs에 담고, 가져오는 쪽이 assets로 옮긴다(키 `enex/<md5>`).
 * DOMParser(XML)를 쓰므로 브라우저(웹뷰) 환경에서 돈다. 잘못된 XML 파일은 건너뛴다.
 */

export type EnexInput = { name: string; text: string };

export type EnexResult = {
  nodes: ImportNode[];
  /** 읽지 못했거나 가져오지 못한 것(파일 이름, 노트 제목 · 그림 개수) */
  skipped: string[];
  /** 본문이 가리키는 리소스 바이트. 키는 `enex/<md5>` */
  blobs: Map<string, Uint8Array>;
  /** 한 개도 읽지 못했을 때의 해요체 안내 */
  error: string | null;
};

export const ENEX_BLOB_PREFIX = "enex/";
/** 파일을 한 개도 읽지 못했을 때의 안내 */

type Resource = { bytes: Uint8Array; mime: string; name: string };
type NoteContext = {
  resources: Map<string, Resource>;
  blobs: Map<string, Uint8Array>;
  keys: Set<string>;
  missing: number;
};

const ALLOWED_HREF = /^(https?:|mailto:)/i;
const CONTAINERS = new Set([
  "div",
  "p",
  "span",
  "b",
  "strong",
  "i",
  "em",
  "u",
  "s",
  "strike",
  "del",
  "code",
  "sup",
  "sub",
  "ul",
  "ol",
  "li",
  "table",
  "thead",
  "tbody",
  "tr",
  "td",
  "th",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "pre",
]);
const BLOCKS = new Set([
  "div",
  "p",
  "ul",
  "ol",
  "table",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "pre",
  "hr",
]);

/** Evernote 날짜(20240101T120000Z)를 ISO 문자열로. 모양이 다르면 undefined */
export function parseEnexDate(text: string): string | undefined {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(text.trim());
  if (!m) return undefined;
  const [y, mo, d, h, mi, s] = m.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  return new Date(Date.UTC(y, mo - 1, d, h, mi, s)).toISOString();
}

/**
 * XML을 읽는다. CDATA(노트 본문 ENML)는 같은 뜻의 이스케이프된 글자로 바꾼 뒤 읽는다.
 * 브라우저 XML 파서와 테스트 환경의 파서가 CDATA를 다르게 다루지 않도록 하기 위해서다.
 */
function parseXml(text: string): Document | null {
  const escaped = text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_m, body: string) =>
    body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"),
  );
  const doc = new DOMParser().parseFromString(escaped, "text/xml");
  return doc.getElementsByTagName("parsererror").length ? null : doc;
}

function childrenNamed(parent: Element, name: string): Element[] {
  return Array.from(parent.children).filter((c) => c.localName === name);
}

function childText(parent: Element, name: string): string {
  return childrenNamed(parent, name)[0]?.textContent?.trim() ?? "";
}

function decodeBase64(text: string): Uint8Array {
  const binary = atob(text.replace(/\s+/g, ""));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function attrEscape(s: string): string {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

function isEl(node: Node, name: string): node is Element {
  return node.nodeType === 1 && (node as Element).localName === name;
}

/** 체크 상자 블록: en-todo 한 개를 직접 가진 문단·div, 또는 en-todo 자체 */
function todoOf(node: Node): Element | null {
  if (isEl(node, "en-todo")) return node;
  if (node.nodeType !== 1 || !["div", "p"].includes((node as Element).localName)) return null;
  return Array.from(node.childNodes).find((c): c is Element => isEl(c, "en-todo")) ?? null;
}

function renderBlocks(parent: Node, ctx: NoteContext): string {
  let out = "";
  let list: string[] | null = null;
  const flush = () => {
    if (list) out += `<ul data-type="taskList">${list.join("")}</ul>`;
    list = null;
  };
  for (const child of Array.from(parent.childNodes)) {
    const todo = todoOf(child);
    if (todo) {
      const rest = Array.from(child.childNodes)
        .filter((c) => c !== todo)
        .map((c) => renderNode(c, ctx))
        .join("")
        .trim();
      const checked = todo.getAttribute("checked") === "true";
      (list ??= []).push(`<li data-type="taskItem" data-checked="${checked}"><p>${rest}</p></li>`);
      continue;
    }
    flush();
    out += renderNode(child, ctx);
  }
  flush();
  return out;
}

function renderMedia(el: Element, ctx: NoteContext): string {
  const hash = (el.getAttribute("hash") ?? "").toLowerCase();
  const resource = ctx.resources.get(hash);
  if (!resource) {
    ctx.missing++;
    return "";
  }
  const key = `${ENEX_BLOB_PREFIX}${hash}`;
  ctx.blobs.set(key, resource.bytes);
  ctx.keys.add(key);
  const mime = resource.mime || el.getAttribute("type") || "";
  if (mime.startsWith("image/")) return `<figure data-local="${attrEscape(key)}"></figure>`;
  const kind =
    mime === "application/pdf" ? "pdf" : /^(audio|video)\//.test(mime) ? "media" : "file";
  return `<div data-attachment="" data-path="${attrEscape(key)}" data-name="${attrEscape(
    resource.name,
  )}" data-size="${resource.bytes.length}" data-mime="${attrEscape(mime)}" data-kind="${kind}" data-caption=""></div>`;
}

function renderNode(node: Node, ctx: NoteContext): string {
  if (node.nodeType === 3 || node.nodeType === 4) return escapeHtml(node.textContent ?? "");
  if (node.nodeType !== 1) return "";
  const el = node as Element;
  switch (el.localName) {
    case "en-todo":
      return "";
    case "en-crypt":
      return `<p>${msg().features.import.encryptedNote}</p>`;
    case "en-media":
      return renderMedia(el, ctx);
    case "br":
      return "<br>";
    case "hr":
      return "<hr>";
    case "a": {
      const href = (el.getAttribute("href") ?? "").trim();
      const inner = renderBlocks(el, ctx);
      return ALLOWED_HREF.test(href) ? `<a href="${attrEscape(href)}">${inner}</a>` : inner;
    }
    default: {
      const name = el.localName;
      if (!CONTAINERS.has(name)) return renderBlocks(el, ctx);
      const inner = renderBlocks(el, ctx);
      if ((name === "div" || name === "p") && !hasBlockChild(el)) {
        return inner.trim() ? `<p>${inner}</p>` : "";
      }
      if (name === "div" || name === "p") return `<div>${inner}</div>`;
      return `<${name}>${inner}</${name}>`;
    }
  }
}

function hasBlockChild(el: Element): boolean {
  return Array.from(el.children).some((c) => BLOCKS.has(c.localName) || c.localName === "en-todo");
}

/** 노트 한 개의 ENML 본문을 HTML 조각으로. 리소스는 MD5로 맞춘다 */
function noteToHtml(
  note: Element,
  title: string,
  blobs: Map<string, Uint8Array>,
  skipped: string[],
) {
  const resources = new Map<string, Resource>();
  for (const res of childrenNamed(note, "resource")) {
    const data = childrenNamed(res, "data")[0]?.textContent ?? "";
    let bytes: Uint8Array;
    try {
      bytes = decodeBase64(data);
    } catch {
      continue;
    }
    const attrs = childrenNamed(res, "resource-attributes")[0];
    const name = (attrs && childText(attrs, "file-name")) || msg().features.import.attachmentFile;
    resources.set(md5Hex(bytes), { bytes, mime: childText(res, "mime"), name });
  }
  const ctx: NoteContext = { resources, blobs, keys: new Set(), missing: 0 };
  const enml = childrenNamed(note, "content")[0]?.textContent ?? "";
  const parsed = parseXml(enml);
  let html: string;
  if (parsed) {
    const root = parsed.getElementsByTagName("en-note")[0] ?? parsed.documentElement;
    html = renderBlocks(root, ctx);
  } else {
    // ENML이 XML로 읽히지 않으면 글자만 살린다
    html = plainTextToHtml(enml.replace(/<[^>]+>/g, ""));
    skipped.push(`${title} ${msg().features.import.skipFormat}`);
  }
  if (ctx.missing) skipped.push(`${title} ${msg().features.import.skipMissingImages(ctx.missing)}`);
  return { html, keys: [...ctx.keys] };
}

/**
 * .enex 파일 한 개를 가져올 항목 목록으로 바꾼다 (DATA-15). fileIndex는 폴더 키를 나누는 번호,
 * blobs는 여러 파일이 함께 쓰는 리소스 바이트 모음(같은 md5는 한 번만 담긴다).
 * 글을 한 파일씩 넘기면 파일 하나가 끝날 때마다 그 파일의 ENML 문자열을 버릴 수 있다.
 */
export function convertEnexFile(
  file: EnexInput,
  fileIndex: number,
  blobs: Map<string, Uint8Array>,
): { nodes: ImportNode[]; skipped: string[]; read: boolean } {
  const nodes: ImportNode[] = [];
  const skipped: string[] = [];
  const doc = parseXml(file.text);
  if (!doc) {
    skipped.push(`${file.name} ${msg().features.import.skipEnexFormat}`);
    return { nodes, skipped, read: false };
  }
  const notes = Array.from(doc.getElementsByTagName("note"));
  const folderTitle =
    file.name.replace(/\.enex$/i, "").trim() || msg().features.import.notebookFallback;
  const folderKey = `e:${fileIndex}`;
  const folder: ImportNode = {
    key: folderKey,
    parentKey: null,
    kind: "folder",
    title: folderTitle,
    tags: [],
    markdown: "",
    assetPaths: [],
  };
  const pages: ImportNode[] = [];
  notes.forEach((note, noteIndex) => {
    const title = childText(note, "title").slice(0, 200) || msg().features.untitled;
    const { html, keys } = noteToHtml(note, title, blobs, skipped);
    const tags = [
      ...new Set(childrenNamed(note, "tag").map((t) => t.textContent?.trim() ?? "")),
    ].filter(Boolean);
    pages.push({
      key: `e:${fileIndex}/${noteIndex}`,
      parentKey: folderKey,
      kind: "page",
      title,
      tags,
      markdown: html,
      assetPaths: keys,
      format: "html",
      createdAt: parseEnexDate(childText(note, "created")),
      updatedAt: parseEnexDate(childText(note, "updated")),
    });
  });
  if (!pages.length) return { nodes, skipped, read: false };
  nodes.push(folder, ...pages);
  return { nodes, skipped, read: true };
}

/** 고른 .enex 파일들을 한꺼번에 가져올 항목 목록으로 바꾼다 (테스트·작은 목록용) */
export function convertEnex(files: EnexInput[]): EnexResult {
  const nodes: ImportNode[] = [];
  const skipped: string[] = [];
  const blobs = new Map<string, Uint8Array>();
  let read = 0;
  files.forEach((file, fileIndex) => {
    const part = convertEnexFile(file, fileIndex, blobs);
    nodes.push(...part.nodes);
    skipped.push(...part.skipped);
    if (part.read) read++;
  });
  const error = read || !files.length ? null : msg().features.import.enexReadError;
  return { nodes, skipped, blobs, error };
}
