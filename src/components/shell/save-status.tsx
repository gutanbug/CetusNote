import { useMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { insetFocus } from "./parts";

export type SaveState = "saved" | "saving" | "error";

type SaveStatusProps = {
  state: SaveState;
  /** 오류일 때 "다시 시도" 버튼 */
  onRetry?: () => void;
  className?: string;
};

/**
 * SH-SaveStatus — 저장됨 · 저장 중 · 오류 (프로토타입 `.sync`, 점 6px + 12px 글자).
 * 저장됨·저장 중은 조용히(role="status"), 오류는 바로(role="alert") 읽는다.
 */
function SaveStatus({ state, onRetry, className }: SaveStatusProps) {
  const m = useMessages();
  return (
    <div
      data-slot="save-status"
      data-state={state}
      className={cn("flex items-center gap-2 px-2 py-1 text-label text-tertiary", className)}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 shrink-0 rounded-pill transition-colors duration-(--dur)",
          state === "saved" && "bg-green-fg",
          state === "saving" && "bg-tertiary",
          state === "error" && "bg-danger",
        )}
      />
      <span
        // 역할이 바뀌면 새로 그려 오류가 곧바로 읽히게 한다
        key={state === "error" ? "alert" : "status"}
        role={state === "error" ? "alert" : "status"}
        className={cn("min-w-0 flex-1 truncate", state === "error" && "text-danger")}
      >
        {m.shell.saveStatus[state]}
      </span>
      {state === "error" && onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className={cn(
            "min-h-6 shrink-0 rounded-pill px-2 text-label font-medium text-accent hover:bg-hover force-hover:bg-hover",
            insetFocus,
          )}
        >
          {m.shell.saveStatus.retry}
        </button>
      ) : null}
    </div>
  );
}

export { SaveStatus, type SaveStatusProps };
