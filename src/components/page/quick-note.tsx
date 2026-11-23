import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Kbd } from "@/components/ui/kbd";
import { fieldFocus } from "@/components/ui/styles";
import { cn } from "@/lib/utils";
import { ArrowRight, Trash2, X } from "lucide-react";
import * as React from "react";

export type QuickNoteItem = {
  id: string;
  text: string;
  /** 보여 줄 시각 — 예: "3분 전" */
  when: string;
};

type QuickNoteProps = {
  /** 최근 것이 위 */
  notes: QuickNoteItem[];
  /** 저장. false(또는 거절)면 입력한 글을 그대로 둔다 */
  onSave: (text: string) => boolean | Promise<boolean>;
  /** 페이지로 올리기 (QN-02) */
  onPromote: (id: string) => void;
  onDelete: (id: string) => void;
  onClose?: () => void;
  className?: string;
};

/**
 * PG-QuickNote — 빠른 메모 패널 (프로토타입 `.qnote`, 320px).
 * 머리 · 입력(⌘↵ 저장) · 메모 목록(페이지로 · 삭제). 감싸는 팝오버는 부르는 쪽이 둔다.
 */
function QuickNote({ notes, onSave, onPromote, onDelete, onClose, className }: QuickNoteProps) {
  const [draft, setDraft] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const titleId = React.useId();

  const save = async () => {
    const text = draft.trim();
    if (!text || saving) {
      inputRef.current?.focus();
      return;
    }
    setSaving(true);
    try {
      if (await onSave(text)) setDraft("");
    } finally {
      setSaving(false);
      inputRef.current?.focus();
    }
  };

  return (
    <section
      data-slot="quick-note"
      aria-labelledby={titleId}
      className={cn(
        "grid max-h-[calc(var(--fit-h)*0.6)] grid-rows-[auto_auto_minmax(0,1fr)]",
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-line py-2 pr-2 pl-3">
        <h2 id={titleId} className="flex-1 text-caption font-semibold text-primary">
          빠른 메모
        </h2>
        {onClose ? (
          <IconButton label="빠른 메모 닫기" noTooltip onClick={onClose}>
            <X strokeWidth={1.5} />
          </IconButton>
        ) : null}
      </div>
      <div className="grid gap-2 p-2">
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              void save();
            }
          }}
          aria-label="새 메모"
          placeholder="떠오른 것을 바로 적어 두세요"
          className={cn(
            "min-h-16 w-full resize-none rounded-md border border-line bg-app p-2 text-ui leading-relaxed text-primary placeholder:text-tertiary",
            "transition-[border-color,box-shadow]",
            fieldFocus,
          )}
        />
        <div className="flex items-center gap-2">
          <span className="flex flex-1 items-center gap-1 text-label text-tertiary">
            <Kbd keys={["⌘", "↵"]} />로 저장
          </span>
          <Button size="sm" loading={saving} onClick={() => void save()}>
            저장
          </Button>
        </div>
      </div>
      <div className="overflow-y-auto px-1 pb-1">
        {notes.length ? (
          <ul aria-label="메모 목록" className="grid">
            {notes.map((n) => (
              <li
                key={n.id}
                className="group/qn grid gap-1 rounded-lg p-2 transition-colors duration-(--dur-fast) hover:bg-hover force-hover:bg-hover"
              >
                <p className="text-ui leading-relaxed wrap-anywhere whitespace-pre-wrap text-primary">
                  {n.text}
                </p>
                <div className="flex items-center gap-1">
                  <span className="flex-1 text-label text-tertiary">{n.when}</span>
                  <div className="flex items-center gap-1 opacity-0 transition-opacity duration-(--dur-fast) group-focus-within/qn:opacity-100 group-hover/qn:opacity-100 force-hover:opacity-100">
                    <Button variant="ghost" size="sm" onClick={() => onPromote(n.id)}>
                      <ArrowRight strokeWidth={1.5} aria-hidden />
                      페이지로
                    </Button>
                    <IconButton label="메모 삭제" onClick={() => onDelete(n.id)}>
                      <Trash2 strokeWidth={1.5} />
                    </IconButton>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-6 text-center text-caption text-tertiary">
            아직 메모가 없어요.
            <br />
            페이지를 만들지 않고 떠오른 생각을 던져 두는 곳이에요.
          </p>
        )}
      </div>
    </section>
  );
}

export { QuickNote, type QuickNoteProps };
