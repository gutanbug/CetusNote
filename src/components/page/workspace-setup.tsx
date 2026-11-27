import { CircleAlert, FolderOpen, FolderPlus, FolderSearch, FolderX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Constellation } from "@/components/ui/constellation";
import { motionTokens } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion, type Variants } from "motion/react";
import * as React from "react";
import { BRAND_MARK_LAYOUT_ID } from "./splash";
import { useMessages } from "@/lib/i18n";

type WorkspaceSetupProps = {
  /** "기본 위치에 만들기"가 쓸 폴더(표시용). 예: "~/Documents/CetusNote" */
  defaultLabel?: string | null;
  /** 지난번에 쓰던 폴더가 없어졌을 때 그 경로(표시용) */
  missingPath?: string | null;
  /** 진행 중인 동작 — 그 버튼에 로딩 표시, 나머지는 잠근다 */
  busy?: "default" | "pick" | null;
  /** 실패 문구(해요체). 예: "폴더에 쓸 수 없어요. 다른 폴더를 골라 주세요." */
  error?: string | null;
  onUseDefault: () => void;
  onPick: () => void;
  /** 스플래시에서 넘어올 때: 별자리는 제자리로 옮겨 오고 나머지가 차례로 나타난다 */
  enter?: boolean;
  className?: string;
};

/**
 * PG-WorkspaceSetup — 첫 실행 때 노트를 저장할 폴더 고르기 (DATA-03).
 * 프로토타입에 없는 화면이라 기존 컴포넌트(UI-Constellation md, UI-Button)와 토큰만으로 조립한다.
 * 기본 동작(기본 위치에 만들기)에 처음 포커스가 간다 — Enter 한 번으로 시작할 수 있다.
 * 바깥 `<main>`은 화면(screens/)이 감싼다.
 */
function WorkspaceSetup({
  defaultLabel,
  missingPath,
  busy,
  error,
  onUseDefault,
  onPick,
  enter = false,
  className,
}: WorkspaceSetupProps) {
  const m = useMessages();
  const titleId = React.useId();
  const reduced = useReducedMotion();
  const t = motionTokens();
  const play = enter && !reduced;
  const list: Variants = {
    show: { transition: { delayChildren: t.slow, staggerChildren: t.fast / 2 } },
  };
  const item: Variants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { duration: t.slow, ease: t.ease } },
  };
  return (
    <section
      aria-labelledby={titleId}
      data-slot="workspace-setup"
      className={cn("grid min-h-full place-items-center bg-app px-6 py-12", className)}
    >
      <motion.div
        className="grid w-105 max-w-full justify-items-center gap-6 text-center"
        variants={list}
        initial={play ? "hidden" : false}
        animate="show"
      >
        <motion.div
          layoutId={enter ? BRAND_MARK_LAYOUT_ID : undefined}
          transition={{ duration: t.slow, ease: t.ease }}
        >
          <Constellation size="md" tone="strong" glow="radiant" />
        </motion.div>
        <motion.div variants={item} className="grid gap-2">
          <h1 id={titleId} className="text-h2 font-semibold text-primary">
            {m.page.workspaceSetup.title}
          </h1>
          <p className="text-ui text-secondary">{m.page.workspaceSetup.subtitle}</p>
        </motion.div>

        {missingPath ? (
          <motion.div
            variants={item}
            role="status"
            className="grid max-w-full justify-items-center gap-1 text-caption text-secondary"
          >
            <p className="flex items-start gap-2 text-left">
              <FolderX strokeWidth={1.5} aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span className="min-w-0">
                {m.page.workspaceSetup.missing}{" "}
                <span className="font-mono break-all text-tertiary">{missingPath}</span>
              </span>
            </p>
            <Button variant="ghost" size="sm" disabled={!!busy} onClick={onPick}>
              <FolderSearch strokeWidth={1.5} aria-hidden />
              {m.page.workspaceSetup.reFind}
            </Button>
          </motion.div>
        ) : null}

        <motion.div variants={item} className="grid w-full gap-2">
          <Button
            autoFocus
            loading={busy === "default"}
            disabled={!!busy}
            onClick={onUseDefault}
            className="w-full"
          >
            <FolderPlus strokeWidth={1.5} aria-hidden />
            {m.page.workspaceSetup.useDefault}
          </Button>
          {defaultLabel ? (
            <p className="font-mono text-label break-all text-tertiary">{defaultLabel}</p>
          ) : null}
          <Button
            variant="secondary"
            loading={busy === "pick"}
            disabled={!!busy}
            onClick={onPick}
            className="mt-2 w-full"
          >
            <FolderOpen strokeWidth={1.5} aria-hidden />
            {m.page.workspaceSetup.pickOther}
          </Button>
        </motion.div>

        {error ? (
          <p role="alert" className="flex items-start gap-2 text-left text-caption text-danger">
            <CircleAlert strokeWidth={1.5} aria-hidden className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        ) : null}
      </motion.div>
    </section>
  );
}

export { WorkspaceSetup, type WorkspaceSetupProps };
