import { Checkbox } from "@/components/ui/checkbox";
import { focusRing } from "@/components/ui/styles";
import { cn } from "@/lib/utils";
import { PageIcon } from "@/components/ui/page-icon";

export type TodayTodo = {
  id: string;
  text: string;
  checked: boolean;
  pageId: string;
  pageTitle: string;
  pageEmoji?: string | null;
};

type TodayTodosProps = {
  items: TodayTodo[];
  onCheckedChange: (id: string, checked: boolean) => void;
  onOpenPage: (pageId: string) => void;
  /** 할 일이 없을 때 */
  emptyText?: string;
  className?: string;
};

/**
 * PG-TodayTodos — 여러 문서의 체크리스트를 한 판에 모은다 (프로토타입 `.panel` + `.todo-line`).
 * 체크하면 그 문서의 항목이 바뀐다. 오른쪽 문서 이름을 누르면 그 문서로 간다.
 */
function TodayTodos({
  items,
  onCheckedChange,
  onOpenPage,
  emptyText = "열린 할 일이 없어요.",
  className,
}: TodayTodosProps) {
  return (
    <div
      data-slot="today-todos"
      className={cn("grid rounded-lg border border-line px-3 py-2", className)}
    >
      {items.length ? (
        <ul className="grid">
          {items.map((t) => (
            <li
              key={t.id}
              data-checked={t.checked || undefined}
              className="group/todo flex items-center gap-2 border-b border-line py-1 last:border-b-0"
            >
              {/* 체크 상자는 16px로 두고, 누름 영역만 사방 4px 넓혀 24px로 만든다 */}
              <span className="grid min-h-6 shrink-0 place-items-center">
                <Checkbox
                  checked={t.checked}
                  onCheckedChange={(c) => onCheckedChange(t.id, c === true)}
                  aria-label={`${t.text} 완료 표시`}
                  className="before:absolute before:-inset-1 before:content-['']"
                />
              </span>
              <span className="min-w-0 flex-1 text-ui text-primary group-data-checked/todo:text-tertiary group-data-checked/todo:line-through">
                {t.text}
              </span>
              <button
                type="button"
                onClick={() => onOpenPage(t.pageId)}
                className={cn(
                  "inline-flex min-h-6 max-w-45 shrink-0 items-center truncate rounded-xs text-label text-tertiary transition-colors duration-(--dur-fast) hover:text-primary force-hover:text-primary",
                  focusRing,
                )}
              >
                {t.pageEmoji ? (
                  <>
                    <PageIcon icon={t.pageEmoji} />{" "}
                  </>
                ) : null}
                {t.pageTitle || "제목 없음"}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-4 text-center text-ui text-tertiary">{emptyText}</p>
      )}
    </div>
  );
}

export { TodayTodos, type TodayTodosProps };
