import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type ReactNodeViewProps,
} from "@tiptap/react";
import { Check, Copy } from "lucide-react";
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
        <select
          id={selectId}
          value={language}
          disabled={!editor.isEditable}
          onChange={(e) =>
            updateAttributes({ language: e.target.value === AUTO_LANGUAGE ? null : e.target.value })
          }
          className={cn(
            "h-6 rounded-pill bg-transparent px-2 text-label text-secondary hover:bg-hover disabled:opacity-100 force-hover:bg-hover",
            focusRing,
          )}
        >
          <option value={AUTO_LANGUAGE}>
            {detected ? `자동 감지 · ${languageLabel(detected)}` : "자동 감지"}
          </option>
          {CODE_LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
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
}).configure({
  lowlight,
  // null = 자동 감지. 플러그인은 언어가 없으면 highlightAuto로 칠한다
  defaultLanguage: null,
  enableTabIndentation: true,
  tabSize: 2,
});
