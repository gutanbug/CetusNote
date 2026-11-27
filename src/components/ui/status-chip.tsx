import { useMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type * as React from "react";
import { chipBase, softColor, type SoftColor } from "./tag-chip";

/** 기본 상태 4단계 — 일반 문서가 쓰고, 새 컬렉션의 처음 상태 목록이 된다 */
const STATUSES = ["할 일", "진행 중", "검토", "완료"] as const; // i18n-ignore
/** 상태 이름. 컬렉션은 자기 상태 목록을 가질 수 있어 문자열이다 (COLL-03) */
type Status = string;
/** 상태 하나 — 이름 + 색 */
type StatusOption = { name: string; color: SoftColor };

/** 기본 상태의 표시 이름 키. 저장 값(한국어)은 그대로 두고 화면에만 옮긴다 */
const STATUS_LABEL_KEY: Record<string, "todo" | "inProgress" | "review" | "done"> = {
  "할 일": "todo", // i18n-ignore
  "진행 중": "inProgress", // i18n-ignore
  검토: "review", // i18n-ignore
  완료: "done", // i18n-ignore
};

const STATUS_COLOR: Record<string, SoftColor> = {
  "할 일": "gray", // i18n-ignore
  "진행 중": "blue", // i18n-ignore
  검토: "orange", // i18n-ignore
  완료: "green", // i18n-ignore
};

const DEFAULT_STATUS_OPTIONS: StatusOption[] = STATUSES.map((name) => ({
  name,
  color: STATUS_COLOR[name]!,
}));

/** 상태 이름의 기본 색 (기본 4단계가 아니면 회색) */
const statusColor = (status: string): SoftColor => STATUS_COLOR[status] ?? "gray";

/** UI-StatusChip — 프로토타입 .chip[data-status]. 색을 주지 않으면 기본 4단계 색 */
function StatusChip({
  status,
  color,
  className,
  ...props
}: Omit<React.ComponentProps<"span">, "children"> & { status: Status; color?: SoftColor }) {
  const m = useMessages();
  const labelKey = STATUS_LABEL_KEY[status];
  return (
    <span
      data-slot="status-chip"
      data-status={status}
      className={cn(chipBase, softColor({ color: color ?? statusColor(status) }), className)}
      {...props}
    >
      <span className="truncate">{labelKey ? m.ui.status[labelKey] : status}</span>
    </span>
  );
}

export {
  DEFAULT_STATUS_OPTIONS,
  StatusChip,
  statusColor,
  STATUSES,
  type Status,
  type StatusOption,
};
