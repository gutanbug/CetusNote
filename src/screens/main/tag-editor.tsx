import { Input } from "@/components/ui/input";
import { menuItem } from "@/components/ui/styles";
import { TagChip } from "@/components/ui/tag-chip";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import * as React from "react";
import { tagColor } from "./tag-colors";

/**
 * 태그 편집 팝오버 안 (PG-Properties의 tagEditor) — 검색, 기존 태그 붙이기, 새 태그 만들기.
 * Enter는 첫 결과(없으면 새로 만들기)를 고른다.
 */
export function TagEditor({
  all,
  assigned,
  onAdd,
}: {
  /** 워크스페이스의 모든 태그 이름 → 색 */
  all: Record<string, string>;
  assigned: string[];
  onAdd: (name: string) => void;
}) {
  const [query, setQuery] = React.useState("");
  const q = query.trim();
  const qn = q.normalize("NFC").toLowerCase();
  const options = Object.keys(all)
    .filter((n) => !assigned.includes(n) && n.normalize("NFC").toLowerCase().includes(qn))
    .sort((a, b) => a.localeCompare(b, "ko"));
  const exact = q && (q in all || assigned.includes(q));
  const add = (name: string) => {
    onAdd(name);
    setQuery("");
  };

  return (
    <div className="grid gap-1">
      <Input
        autoFocus
        aria-label="태그 검색 또는 만들기"
        placeholder="태그 검색 또는 만들기"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || e.nativeEvent.isComposing || e.keyCode === 229) return;
          e.preventDefault();
          const pick = options[0] ?? (q && !exact ? q : undefined);
          if (pick) add(pick);
        }}
      />
      <ul aria-label="태그" className="grid max-h-60 overflow-y-auto">
        {options.map((name) => (
          <li key={name}>
            <button type="button" className={menuItem} onClick={() => add(name)}>
              <TagChip color={tagColor(all[name])}>{name}</TagChip>
            </button>
          </li>
        ))}
        {q && !exact ? (
          <li>
            <button type="button" className={cn(menuItem)} onClick={() => add(q)}>
              <Plus strokeWidth={1.5} aria-hidden />“{q}” 태그 만들기
            </button>
          </li>
        ) : null}
        {!options.length && !q ? (
          <li className="px-2 py-1 text-caption text-tertiary">
            {Object.keys(all).length ? "모든 태그를 붙였어요." : "태그 이름을 입력해 만들어요."}
          </li>
        ) : null}
      </ul>
    </div>
  );
}
