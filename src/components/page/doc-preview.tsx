import { cn } from "@/lib/utils";
import { Check, Image as ImageIcon, Table } from "lucide-react";
import { msg, useMessages } from "@/lib/i18n";

/** Tiptap JSON 노드 (필요한 만큼만) */
export type PreviewNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: PreviewNode[];
};

type Line = {
  kind: "heading" | "text" | "bullet" | "number" | "task" | "quote" | "code" | "rule" | "media";
  text: string;
  depth: number;
  level?: number;
  checked?: boolean;
  icon?: "image" | "table";
  emoji?: string;
};

const textOf = (n: PreviewNode): string =>
  n.type === "text"
    ? (n.text ?? "")
    : n.type === "hardBreak"
      ? " "
      : n.type === "pageMention"
        ? `@${String(n.attrs?.label ?? "")}`
        : (n.content ?? []).map(textOf).join("");

/** 문서를 미리보기 줄로 펴기 — 블록 하나가 한 줄(목록은 항목마다), 빈 문단은 뺀다 */
function lines(nodes: PreviewNode[] = [], depth = 0, out: Line[] = [], max = 12): Line[] {
  for (const n of nodes) {
    if (out.length >= max) break;
    switch (n.type) {
      case "heading":
        out.push({ kind: "heading", text: textOf(n), depth, level: Number(n.attrs?.level) || 1 });
        break;
      case "paragraph": {
        const t = textOf(n).trim();
        if (t) out.push({ kind: "text", text: t, depth });
        break;
      }
      case "bulletList":
      case "orderedList":
      case "taskList":
        for (const item of n.content ?? []) {
          if (out.length >= max) break;
          const [first, ...rest] = item.content ?? [];
          out.push({
            kind: n.type === "taskList" ? "task" : n.type === "orderedList" ? "number" : "bullet",
            text: first ? textOf(first) : "",
            depth,
            checked: item.attrs?.checked === true,
          });
          lines(rest, depth + 1, out, max);
        }
        break;
      case "blockquote":
        out.push({ kind: "quote", text: textOf(n), depth });
        break;
      case "codeBlock":
        out.push({ kind: "code", text: textOf(n).split("\n")[0] ?? "", depth });
        break;
      case "horizontalRule":
        out.push({ kind: "rule", text: "", depth });
        break;
      case "image":
        out.push({ kind: "media", text: textOf(n), depth, icon: "image" });
        break;
      case "table":
        out.push({ kind: "media", text: msg().page.docPreview.table, depth, icon: "table" });
        break;
      case "callout":
        out.push({
          kind: "text",
          text: textOf(n),
          depth,
          emoji: typeof n.attrs?.emoji === "string" ? n.attrs.emoji : undefined,
        });
        break;
      case "details":
        lines(n.content?.slice(0, 1), depth, out, max);
        break;
      default:
        if (n.content) lines(n.content, depth, out, max);
    }
  }
  return out;
}

const INDENT = ["", "pl-3", "pl-6"] as const;

type DocPreviewProps = {
  doc: PreviewNode | null | undefined;
  /** 보여 줄 줄 수 상한 */
  max?: number;
  className?: string;
};

/**
 * PG-DocPreview — 문서 앞부분을 작게 읽기 전용으로 (템플릿 카드 미리보기, PAGE-14).
 * 블록을 한 줄씩(제목은 굵게, 목록·할 일은 기호, 인용은 왼쪽 선, 코드는 고정폭) 그린다.
 * 에디터를 띄우지 않는 가벼운 그림이라 카드 여러 장에 써도 된다. 비어 있으면 "빈 문서".
 */
function DocPreview({ doc, max = 7, className }: DocPreviewProps) {
  const m = useMessages();
  const list = lines(doc?.content, 0, [], max);
  return (
    <div
      aria-hidden
      data-slot="doc-preview"
      className={cn(
        "grid content-start gap-0.5 overflow-hidden text-label text-secondary",
        className,
      )}
    >
      {list.length ? (
        list.map((l, i) => (
          <div
            key={i}
            className={cn(
              "flex min-w-0 items-center gap-1.5",
              INDENT[Math.min(l.depth, INDENT.length - 1)],
            )}
          >
            {l.kind === "bullet" ? <span className="shrink-0 text-tertiary">•</span> : null}
            {l.kind === "number" ? <span className="shrink-0 text-tertiary">1.</span> : null}
            {l.kind === "task" ? (
              <span
                className={cn(
                  "grid size-2.5 shrink-0 place-items-center rounded-xs border border-tertiary",
                  l.checked && "border-accent-fill bg-accent-fill text-accent-fill-on",
                )}
              >
                {l.checked ? <Check strokeWidth={1.5} className="size-2" /> : null}
              </span>
            ) : null}
            {l.kind === "media" ? (
              l.icon === "table" ? (
                <Table strokeWidth={1.5} className="size-3 shrink-0 text-tertiary" />
              ) : (
                <ImageIcon strokeWidth={1.5} className="size-3 shrink-0 text-tertiary" />
              )
            ) : null}
            {l.emoji ? <span className="shrink-0">{l.emoji}</span> : null}
            {l.kind === "rule" ? (
              <span className="my-1 h-px flex-1 bg-line" />
            ) : (
              <span
                className={cn(
                  "min-w-0 truncate",
                  l.kind === "heading" && "font-semibold text-primary",
                  l.kind === "heading" && l.level === 1 && "text-caption",
                  l.kind === "quote" && "border-l-2 border-line-strong pl-1.5",
                  l.kind === "code" && "rounded-xs bg-hover px-1 font-mono",
                  l.kind === "task" && l.checked && "text-tertiary line-through",
                  !l.text && "text-tertiary",
                )}
              >
                {l.text || (l.kind === "task" || l.kind === "bullet" ? " " : "")}
              </span>
            )}
          </div>
        ))
      ) : (
        <span className="text-tertiary">{m.page.docPreview.empty}</span>
      )}
    </div>
  );
}

export { DocPreview, type DocPreviewProps };
