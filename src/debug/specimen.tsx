import { cn } from "@/lib/utils";
import type * as React from "react";

// 스토리·Debug 화면 전용 견본 배치. 앱 화면에서는 쓰지 않는다.

/** 상태 이름 + 견본 한 줄. force를 주면 그 줄만 hover/active를 강제한다. */
export function Row({
  name,
  force,
  children,
  className,
}: {
  name: string;
  force?: "hover" | "active";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="flex min-h-10 items-center gap-4">
      <span className="w-28 shrink-0 font-mono text-label text-secondary">{name}</span>
      <div data-force={force} className={cn("flex flex-wrap items-center gap-3", className)}>
        {children}
      </div>
    </div>
  );
}

/** 견본 묶음 (제목 + 줄들) */
export function Sheet({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-1">
      {title ? (
        <h2 className="mb-2 text-label font-semibold tracking-(--tracking-label) text-secondary">
          {title}
        </h2>
      ) : null}
      {children}
    </section>
  );
}

export function Stack({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-8">{children}</div>;
}
