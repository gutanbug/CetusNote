import { cn } from "@/lib/utils";
import { ExternalLink, Link2Off } from "lucide-react";
import * as React from "react";
import { Button } from "./button";
import { IconButton } from "./icon-button";
import { Input } from "./input";

type LinkEditorProps = {
  /** 현재 링크. 없으면 새 링크 입력 */
  href?: string;
  onSubmit: (href: string) => void;
  onOpen?: (href: string) => void;
  onRemove?: () => void;
  className?: string;
};

/** http(s)가 없으면 붙인다. 공백이면 null */
function normalizeHref(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return v;
  return `https://${v}`;
}

/**
 * OV-LinkPopover의 내용 — URL 입력 · 열기 · 제거. Enter로 적용한다.
 * OV-Popover 안에 넣어 쓴다.
 */
function LinkEditor({ href = "", onSubmit, onOpen, onRemove, className }: LinkEditorProps) {
  const [value, setValue] = React.useState(href);
  const id = React.useId();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = normalizeHref(value);
    if (next) onSubmit(next);
  };
  return (
    <form
      data-slot="link-editor"
      onSubmit={submit}
      className={cn("flex items-center gap-1 p-1", className)}
    >
      <label htmlFor={id} className="sr-only">
        링크 주소
      </label>
      <Input
        id={id}
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="https://… 붙여넣기"
        className="w-60"
      />
      <Button type="submit" size="sm" disabled={!value.trim()}>
        적용
      </Button>
      {href && onOpen ? (
        <IconButton label="링크 열기" onClick={() => onOpen(href)}>
          <ExternalLink strokeWidth={1.5} />
        </IconButton>
      ) : null}
      {href && onRemove ? (
        <IconButton label="링크 제거" onClick={onRemove}>
          <Link2Off strokeWidth={1.5} />
        </IconButton>
      ) : null}
    </form>
  );
}

export { LinkEditor, normalizeHref, type LinkEditorProps };
