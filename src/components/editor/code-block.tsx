import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type ReactNodeViewProps,
} from "@tiptap/react";
import { Check, ChevronDown, Copy } from "lucide-react";
import * as React from "react";
import { IconButton } from "@/components/ui/icon-button";
import { focusRing } from "@/components/ui/styles";
import {
  AUTO_LANGUAGE,
  CODE_LANGUAGES,
  detectLanguage,
  languageLabel,
  lowlight,
  normalizeLanguage,
} from "@/lib/code-language";
import { cn } from "@/lib/utils";
import { incrementalLowlight } from "./code-highlight";

export { CODE_LANGUAGES, lowlight, normalizeLanguage };

function CodeBlockView({ node, updateAttributes, editor }: ReactNodeViewProps) {
  const [copied, setCopied] = React.useState(false);
  const raw = node.attrs.language as string | null;
  const language = normalizeLanguage(raw);

  const auto = language === AUTO_LANGUAGE;
  // 줄임말·모르는 언어는 저장 값도 목록 이름으로 바꾼다 (자동 감지는 null로 둔다)
  React.useEffect(() => {
    if (!editor.isEditable) return;
    if (auto ? raw !== null : raw !== language)
      updateAttributes({ language: auto ? null : language });
  }, [raw, language, auto, editor, updateAttributes]);
  // 자동 감지: 입력이 잦아도 화면이 밀리지 않게 늦춰서 추측한다
  const text = React.useDeferredValue(node.textContent);
  const detected = React.useMemo(() => (auto ? detectLanguage(text) : undefined), [auto, text]);
  const selectId = React.useId();
  const autoLabel = detected ? `자동 감지 · ${languageLabel(detected)}` : "자동 감지";
  const selectedLabel = auto ? autoLabel : languageLabel(language);

  React.useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(node.textContent);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <NodeViewWrapper className="sn-codeblock" data-copied={copied || undefined}>
      <div className="sn-codeblock-bar" contentEditable={false}>
        <label htmlFor={selectId} className="sr-only">
          코드 언어
        </label>
        {/* 너비는 현재 선택된 이름에 맞춘다 (숨은 복제 글자가 크기를 정하고, select는 그 칸을 채운다) */}
        <span className="relative inline-grid">
          <span
            aria-hidden="true"
            className="invisible col-start-1 row-start-1 h-6 px-2 pr-6 text-label leading-6 whitespace-pre"
          >
            {selectedLabel}
          </span>
          <select
            id={selectId}
            value={language}
            disabled={!editor.isEditable}
            onChange={(e) =>
              updateAttributes({
                language: e.target.value === AUTO_LANGUAGE ? null : e.target.value,
              })
            }
            className={cn(
              "col-start-1 row-start-1 h-6 w-full appearance-none rounded-pill bg-transparent pr-6 pl-2 text-label text-secondary hover:bg-hover disabled:opacity-100 force-hover:bg-hover",
              focusRing,
            )}
          >
            <option value={AUTO_LANGUAGE}>{autoLabel}</option>
            {CODE_LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden="true"
            strokeWidth={1.5}
            className="pointer-events-none absolute top-1/2 right-1.5 size-3.5 -translate-y-1/2 text-tertiary"
          />
        </span>
        <span className="flex-1" />
        <span aria-live="polite" className="text-label text-secondary">
          {copied ? "복사됨" : ""}
        </span>
        <IconButton label="코드 복사" onClick={copy} on={copied}>
          {copied ? <Check strokeWidth={1.5} /> : <Copy strokeWidth={1.5} />}
        </IconButton>
      </div>
      <pre spellCheck={false}>
        <NodeViewContent<"code">
          as="code"
          className={`language-${auto ? (detected ?? "plaintext") : language}`}
        />
      </pre>
    </NodeViewWrapper>
  );
}

/** ED-CodeBlock — 언어 선택(기본은 자동 감지), lowlight 하이라이트, 복사. ``` 로 만든다. */
export const CodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView);
  },
  addProseMirrorPlugins() {
    // Tiptap 기본 lowlight 플러그인(키 `lowlight$`)은 입력마다 문서 전체를 훑는다. 바뀐 블록만 칠하는 것으로 바꾼다 (SYS-11)
    // 플러그인의 키는 타입에 없어서 내부 값(`key`)을 문자열로 읽는다
    const rest = (this.parent?.() ?? []).filter(
      (p) => !String((p as { key?: unknown }).key).startsWith("lowlight$"),
    );
    return [...rest, incrementalLowlight({ name: this.name, lowlight, defaultLanguage: null })];
  },
}).configure({
  lowlight,
  // null = 자동 감지. 플러그인은 언어가 없으면 highlightAuto로 칠한다
  defaultLanguage: null,
  enableTabIndentation: true,
  tabSize: 2,
});
