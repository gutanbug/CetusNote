import { cn } from "@/lib/utils";
import * as React from "react";

type ResizerProps = {
  /** 지금 너비(px) */
  width: number;
  onWidthChange: (width: number) => void;
  /** 두 번 누르면 기본 너비로 */
  onReset?: () => void;
  min?: number;
  max?: number;
  /** ←→ 한 번에 바뀌는 너비 */
  step?: number;
  label?: string;
  /** 핸들이 붙는 쪽 — right(기본: 사이드바 오른쪽 끝) · left(오른쪽 패널의 왼쪽 끝, 왼쪽으로 끌면 넓어진다) */
  edge?: "right" | "left";
  className?: string;
};

/**
 * SH-Resizer — 사이드바 오른쪽 끝 드래그 핸들 (프로토타입 `.sidebar-resizer`).
 * 마우스를 올리거나 끄는 동안, 키보드로 오면 accent 2px 선이 보인다. ←→ 16px, Home/End 최소·최대,
 * 두 번 누르기·Enter로 기본 너비.
 */
function Resizer({
  width,
  onWidthChange,
  onReset,
  min = 200,
  max = 400,
  step = 16,
  label = "사이드바 너비 조절",
  edge = "right",
  className,
}: ResizerProps) {
  const [dragging, setDragging] = React.useState(false);
  /** 패널의 고정된 쪽 x — right 핸들이면 왼쪽 끝, left 핸들이면 오른쪽 끝 */
  const anchorRef = React.useRef(0);
  const grow = edge === "left" ? -1 : 1;
  const clamp = (w: number) => Math.round(Math.min(max, Math.max(min, w)));

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={width}
      aria-valuetext={`${width}픽셀`}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      data-slot="resizer"
      data-dragging={dragging || undefined}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        const rect = e.currentTarget.parentElement?.getBoundingClientRect();
        anchorRef.current = (edge === "left" ? rect?.right : rect?.left) ?? 0;
        setDragging(true);
      }}
      onPointerMove={(e) =>
        dragging && onWidthChange(clamp((e.clientX - anchorRef.current) * grow))
      }
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
      onDoubleClick={onReset}
      onKeyDown={(e) => {
        const next = {
          ArrowLeft: width - step * grow,
          ArrowRight: width + step * grow,
          Home: min,
          End: max,
        }[e.key];
        if (e.key === "Enter" && onReset) {
          e.preventDefault();
          onReset();
          return;
        }
        if (next === undefined) return;
        e.preventDefault();
        onWidthChange(clamp(next));
      }}
      className={cn(
        "absolute inset-y-0 z-5 w-1.25 cursor-col-resize touch-none outline-none",
        edge === "left" ? "left-0 after:left-0" : "right-0 after:right-0",
        "after:absolute after:inset-y-0 after:w-0.5 after:bg-accent after:opacity-0 after:transition-opacity after:duration-(--dur-fast)",
        "hover:after:opacity-100 focus-visible:after:opacity-100 data-dragging:after:opacity-100 force-hover:after:opacity-100",
        className,
      )}
    />
  );
}

export { Resizer, type ResizerProps };
