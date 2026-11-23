import { cn } from "@/lib/utils";
import type * as React from "react";
import { chipBase, softColor, type SoftColor } from "./tag-chip";

/** 기본 상태 4단계 — 일반 문서가 쓰고, 새 컬렉션의 처음 상태 목록이 된다 */
const STATUSES = ["할 일", "진행 중", "검토", "완료"] as const;
/** 상태 이름. 컬렉션은 자기 상태 목록을 가질 수 있어 문자열이다 (COLL-03) */
type Status = string;
/** 상태 하나 — 이름 + 색 */
type StatusOption = { name: string; color: SoftColor };

const STATUS_COLOR: Record<string, SoftColor> = {
  "할 일": "gray",
  "진행 중": "blue",
  검토: "orange",
  완료: "green",
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
  return (
    <span
      data-slot="status-chip"
      data-status={status}
      className={cn(chipBase, softColor({ color: color ?? statusColor(status) }), className)}
      {...props}
    >
      <span className="truncate">{status}</span>
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
