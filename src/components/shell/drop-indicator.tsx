import { cn } from "@/lib/utils";

export type DropPosition = "before" | "after" | "inside";

/**
 * SH-DropIndicator — 트리에서 끌어다 놓을 자리 (SHELL-06, 프로토타입 `[data-dropline]`: 포인트 색 2px 선).
 * 위/아래: 행의 위·아래 가장자리에 선. 안쪽: 행 전체 테두리. 부모 행(position: relative) 안에 둔다.
 */
function DropIndicator({ position, className }: { position: DropPosition; className?: string }) {
  return (
    <span
      aria-hidden
      data-slot="drop-indicator"
      data-position={position}
      className={cn(
        "pointer-events-none absolute",
        position === "inside"
          ? "inset-0 rounded-md outline-2 -outline-offset-2 outline-accent outline-solid"
          : "inset-x-1 h-0.5 rounded-pill bg-accent",
        position === "before" && "top-0",
        position === "after" && "bottom-0",
        className,
      )}
    />
  );
}

export { DropIndicator };
