import { cn } from "@/lib/utils";
import type * as React from "react";

type SettingsRowProps = {
  name: string;
  description?: React.ReactNode;
  /** 오른쪽 컨트롤 (스위치, 입력, 버튼 …). stacked면 아래에 놓인다 */
  children?: React.ReactNode;
  /** 컨트롤 id — 이름을 그 컨트롤의 label로 쓴다. 설명 id는 `${controlId}-desc`(컨트롤의 aria-describedby에 넣는다) */
  controlId?: string;
  /** 컨트롤을 이름 아래 전체 폭으로 (테마 카드, 포인트 색 견본) */
  stacked?: boolean;
  className?: string;
};

/** PG-SettingsRow — 이름 + 설명 + 컨트롤 한 줄 (프로토타입 `.set-row`). 행 사이에 구분선. */
function SettingsRow({
  name,
  description,
  children,
  controlId,
  stacked,
  className,
}: SettingsRowProps) {
  const Name = controlId ? "label" : "span";
  const text = (
    <span className="grid min-w-0 flex-1 gap-0.5">
      <Name htmlFor={controlId} className="text-ui font-medium text-primary">
        {name}
      </Name>
      {description ? (
        <span
          id={controlId ? `${controlId}-desc` : undefined}
          className="text-caption text-secondary"
        >
          {description}
        </span>
      ) : null}
    </span>
  );
  return (
    <div
      data-slot="settings-row"
      className={cn(
        "border-b border-line py-3 last:border-b-0",
        stacked ? "grid gap-3" : "flex items-start gap-4",
        className,
      )}
    >
      {text}
      {children ? (
        <div className={cn(stacked ? "min-w-0" : "flex shrink-0 items-center gap-2")}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

export { SettingsRow, type SettingsRowProps };
