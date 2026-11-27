import type { Attribute } from "@tiptap/core";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import type { NodeViewRendererProps } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { Check, ChevronDown, Copy } from "lucide-react";
import { createPortal } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { focusRing, press } from "@/components/ui/styles";
import {
  AUTO_LANGUAGE,
  CODE_LANGUAGES,
  detectLanguage,
  languageLabel,
  lowlight,
  normalizeLanguage,
  storedLanguage,
} from "@/lib/code-language";
import { cn } from "@/lib/utils";
import { incrementalLowlight } from "./code-highlight";

export { CODE_LANGUAGES, lowlight, normalizeLanguage };

/**
 * 아이콘(꺾쇠·복사·확인)은 lucide-react로 그리되, React 루트는 블록에 마우스·포커스·선택이 갈 때 한 번만 만든다.
 * 문서가 열릴 때 블록마다 루트를 만들면 10k 블록에서 열기가 몇 분 걸린다 (SYS-11).
 */
function BlockChrome({
  copied,
  chevronSlot,
  iconSlot,
}: {
  copied: boolean;
  chevronSlot: HTMLElement;
  iconSlot: HTMLElement;
}) {
  return (
    <>
      {createPortal(
        <ChevronDown
          strokeWidth={1.5}
          aria-hidden="true"
          className="pointer-events-none size-3.5 text-tertiary"
        />,
        chevronSlot,
      )}
      {createPortal(
        copied ? (
          <Check strokeWidth={1.5} aria-hidden="true" />
        ) : (
          <Copy strokeWidth={1.5} aria-hidden="true" />
        ),
        iconSlot,
      )}
    </>
  );
}

const SELECT_CLASS = cn(
  "col-start-1 row-start-1 h-6 w-full appearance-none rounded-pill bg-transparent pr-6 pl-2 text-label text-secondary hover:bg-hover disabled:opacity-100 force-hover:bg-hover",
  focusRing,
);
const COPY_CLASS = cn(
  "inline-grid size-6.5 shrink-0 place-items-center rounded-pill text-secondary",
  "hover:bg-active hover:text-primary force-hover:bg-active force-hover:text-primary",
  "disabled:pointer-events-none disabled:opacity-35 aria-pressed:text-accent data-[on=true]:text-accent",
  "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  focusRing,
  press,
);

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

/**
 * ED-CodeBlock 노드 뷰 — React를 쓰지 않는 DOM 노드 뷰.
 * 언어 선택(목록은 처음 열 때 채운다), 복사, 자동 감지 표시를 DOM으로 직접 그린다.
 * 본문은 `code`가 맡고 하이라이트 장식(incrementalLowlight)은 그 안에 붙는다.
 */
type LanguageFix = { pos: () => number | undefined; language: string | null };
const pendingFixes = new WeakMap<NodeViewRendererProps["editor"], LanguageFix[]>();

/** 저장된 언어 이름 고치기를 모아 다음 마이크로태스크에 한 트랜잭션으로 보낸다 */
function queueLanguageFix(
  editor: NodeViewRendererProps["editor"],
  pos: () => number | undefined,
  language: string | null,
) {
  const list = pendingFixes.get(editor);
  if (list) {
    list.push({ pos, language });
    return;
  }
  pendingFixes.set(editor, [{ pos, language }]);
  queueMicrotask(() => {
    const fixes = pendingFixes.get(editor) ?? [];
    pendingFixes.delete(editor);
    if (editor.isDestroyed) return;
    editor.commands.command(({ tr }) => {
      let changed = false;
      for (const fix of fixes) {
        const at = fix.pos();
        if (typeof at !== "number") continue;
        // 속성만 바꾸므로 위치가 밀리지 않는다
        const current = tr.doc.nodeAt(at);
        if (!current || current.type.name !== "codeBlock") continue;
        if (current.attrs.language === fix.language) continue;
        tr.setNodeMarkup(at, undefined, { ...current.attrs, language: fix.language });
        changed = true;
      }
      // 여는 중에 생기는 정리라 실행 취소 기록에 남기지 않는다
      if (changed) tr.setMeta("addToHistory", false);
      return changed;
    });
  });
}

function codeBlockView({ node: initial, editor, getPos }: NodeViewRendererProps) {
  let node = initial;
  let copyTimer: ReturnType<typeof setTimeout> | undefined;
  let detectTimer: ReturnType<typeof setTimeout> | undefined;
  let optionsReady = false;
  let lastText: string | null = null;
  let detected: string | undefined;
  let destroyed = false;

  const selectId = `sn-code-lang-${Math.random().toString(36).slice(2, 10)}`;
  const dom = el("div", "sn-codeblock");
  const bar = el("div", "sn-codeblock-bar");
  bar.contentEditable = "false";
  const label = el("label", "sr-only");
  label.htmlFor = selectId;
  label.textContent = "코드 언어";
  const wrap = el("span", "relative inline-grid");
  const sizer = el(
    "span",
    "invisible col-start-1 row-start-1 h-6 px-2 pr-6 text-label leading-6 whitespace-pre",
  );
  sizer.setAttribute("aria-hidden", "true");
  const select = el("select", SELECT_CLASS);
  select.id = selectId;
  select.spellcheck = false;
  const chevron = el("span", "pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2");
  const spacer = el("span", "flex-1");
  const status = el("span", "text-label text-secondary");
  status.setAttribute("aria-live", "polite");
  const copyBtn = el("button", COPY_CLASS);
  copyBtn.type = "button";
  copyBtn.setAttribute("data-press", "");
  copyBtn.setAttribute("aria-label", "코드 복사");
  const copyIcon = el("span", "inline-grid place-items-center");
  copyBtn.append(copyIcon);
  const pre = el("pre");
  pre.spellcheck = false;
  const code = el("code");

  wrap.append(sizer, select, chevron);
  bar.append(label, wrap, spacer, status, copyBtn);
  pre.append(code);
  dom.append(bar, pre);

  const autoLabel = () => (detected ? `자동 감지 · ${languageLabel(detected)}` : "자동 감지");
  const attrLanguage = () => node.attrs.language as string | null;

  /** 목록을 채우기 전에는 현재 언어 한 칸만 둔다. 펼칠 때 전체 목록을 채운다. */
  function paintOptions() {
    const language = normalizeLanguage(attrLanguage());
    const auto = language === AUTO_LANGUAGE;
    if (!optionsReady) {
      select.replaceChildren();
      const only = new Option(auto ? autoLabel() : languageLabel(language), language);
      select.append(only);
    } else {
      const first = select.options[0];
      if (first && first.value === AUTO_LANGUAGE) first.textContent = autoLabel();
    }
    select.value = language;
    select.disabled = !editor.isEditable;
    sizer.textContent = auto ? autoLabel() : languageLabel(language);
    code.className = `language-${auto ? (detected ?? "plaintext") : language}`;
  }

  function fillOptions() {
    if (optionsReady) return;
    optionsReady = true;
    const language = normalizeLanguage(attrLanguage());
    select.replaceChildren(
      new Option(autoLabel(), AUTO_LANGUAGE),
      ...CODE_LANGUAGES.map((l) => new Option(l.label, l.value)),
    );
    select.value = language;
  }

  function setLanguage(value: string | null) {
    const pos = getPos();
    if (typeof pos !== "number") return;
    editor.commands.command(({ tr }) => {
      const current = tr.doc.nodeAt(pos);
      if (!current) return false;
      tr.setNodeMarkup(pos, undefined, { ...current.attrs, language: value });
      return true;
    });
  }

  function normalizeStoredLanguage() {
    if (!editor.isEditable) return;
    const raw = attrLanguage();
    const language = normalizeLanguage(raw);
    const auto = language === AUTO_LANGUAGE;
    if (auto ? raw !== null : raw !== language) {
      // 줄임말·모르는 언어는 저장 값도 목록 이름으로 바꾼다 (자동 감지는 null로 둔다)
      // 열 때 여러 블록이 한꺼번에 고치므로 한 트랜잭션으로 모은다 (SYS-11).
      // 블록마다 따로 보내면 블록 수만큼 하이라이트 전체 재계산·저장 비교가 돌아 큰 문서가 수십 초 멈춘다
      queueLanguageFix(editor, () => (destroyed ? undefined : getPos()), auto ? null : language);
    }
  }

  /** 자동 감지는 입력이 잦아도 화면이 밀리지 않게 늦춰서 추측한다 */
  function scheduleDetect(delay: number) {
    clearTimeout(detectTimer);
    detectTimer = setTimeout(() => {
      if (destroyed) return;
      const text = node.textContent;
      const next = attrLanguage() === null ? detectLanguage(text) : undefined;
      if (next === detected) return;
      detected = next;
      lastText = text;
      paintOptions();
    }, delay);
  }

  function setCopied(value: boolean) {
    copiedNow = value;
    dom.toggleAttribute("data-copied", value);
    if (value) copyBtn.setAttribute("data-on", "true");
    else copyBtn.removeAttribute("data-on");
    status.textContent = value ? "복사됨" : "";
    if (chromeRoot)
      chromeRoot.render(
        <BlockChrome copied={copiedNow} chevronSlot={chevron} iconSlot={copyIcon} />,
      );
  }

  /** 꺾쇠·복사 아이콘의 React 루트 — 처음 마우스·포커스·선택이 갈 때 한 번 만든다 */
  let chromeRoot: Root | undefined;
  let copiedNow = false;
  function ensureChrome() {
    if (chromeRoot || destroyed) return;
    // 루트 컨테이너는 떼어 둔다. 실제 출력은 아래 두 슬롯으로 포털이 보낸다
    chromeRoot = createRoot(document.createElement("div"));
    chromeRoot.render(<BlockChrome copied={copiedNow} chevronSlot={chevron} iconSlot={copyIcon} />);
  }
  const onHover = () => ensureChrome();
  dom.addEventListener("pointerenter", onHover);
  dom.addEventListener("focusin", onHover);

  select.addEventListener("pointerdown", fillOptions);
  select.addEventListener("focus", fillOptions);
  select.addEventListener("keydown", fillOptions, { once: true });
  select.addEventListener("change", () => {
    if (!editor.isEditable) return;
    const v = select.value;
    setLanguage(v === AUTO_LANGUAGE ? null : v);
  });
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(node.textContent);
      setCopied(true);
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
      status.textContent = "복사 실패";
    }
  });

  paintOptions();
  normalizeStoredLanguage();
  if (attrLanguage() === null) scheduleDetect(0);

  return {
    dom,
    contentDOM: code,
    update(next: typeof node) {
      if (next.type !== node.type) return false;
      const textChanged = next.textContent !== lastText;
      node = next;
      if (textChanged && attrLanguage() === null) scheduleDetect(150);
      paintOptions();
      normalizeStoredLanguage();
      return true;
    },
    ignoreMutation(m: { type: string; target: Node }) {
      if (m.type === "selection") return !code.contains(m.target);
      if (m.target === code) return m.type === "attributes";
      return !code.contains(m.target);
    },
    stopEvent(event: Event) {
      const t = event.target;
      return t instanceof Node && bar.contains(t);
    },
    selectNode() {
      dom.classList.add("ProseMirror-selectednode");
      ensureChrome();
    },
    deselectNode() {
      dom.classList.remove("ProseMirror-selectednode");
    },
    destroy() {
      destroyed = true;
      clearTimeout(copyTimer);
      clearTimeout(detectTimer);
      const root = chromeRoot;
      chromeRoot = undefined;
      // 편집 중 PM이 노드를 지우는 순서와 React 렌더가 겹치지 않게 한 틱 뒤에 내린다
      if (root) queueMicrotask(() => root.unmount());
    },
  };
}

/** 에디터의 편집 가능 상태가 바뀌면 열린 모든 언어 선택의 disabled를 맞춘다 (생성 시점은 노드 뷰가 맞춘다) */
const codeBlockEditable = new Plugin({
  view() {
    let last: boolean | undefined;
    return {
      update(view) {
        if (view.editable === last) return;
        last = view.editable;
        view.dom
          .querySelectorAll<HTMLSelectElement>(".sn-codeblock select")
          .forEach((s) => (s.disabled = !view.editable));
      },
    };
  },
});

/** ED-CodeBlock — 언어 선택(기본은 자동 감지), lowlight 하이라이트, 복사. ``` 로 만든다. */
export const CodeBlock = CodeBlockLowlight.extend({
  addAttributes() {
    // HTML에서 읽을 때(붙여넣기 등)도 줄임말을 목록 이름으로 바꿔서, 열 때 고치는 트랜잭션이 생기지 않게 한다 (SYS-11)
    const parent: Record<string, Attribute> = this.parent?.() ?? {};
    const language: Attribute = parent.language ?? { default: null };
    return {
      ...parent,
      language: {
        ...language,
        parseHTML: (element: HTMLElement) => {
          const raw = language.parseHTML ? language.parseHTML.call(this, element) : null;
          return storedLanguage(raw);
        },
      },
    };
  },
  addNodeView() {
    return (props) => codeBlockView(props);
  },
  addProseMirrorPlugins() {
    // Tiptap 기본 lowlight 플러그인(키 `lowlight$`)은 입력마다 문서 전체를 훑는다. 바뀐 블록만 칠하는 것으로 바꾼다 (SYS-11)
    // 플러그인의 키는 타입에 없어서 내부 값(`key`)을 문자열로 읽는다
    const rest = (this.parent?.() ?? []).filter(
      (p) => !String((p as { key?: unknown }).key).startsWith("lowlight$"),
    );
    return [
      ...rest,
      incrementalLowlight({ name: this.name, lowlight, defaultLanguage: null }),
      codeBlockEditable,
    ];
  },
}).configure({
  lowlight,
  // null = 자동 감지. 플러그인은 언어가 없으면 highlightAuto로 칠한다
  defaultLanguage: null,
  enableTabIndentation: true,
  tabSize: 2,
});
