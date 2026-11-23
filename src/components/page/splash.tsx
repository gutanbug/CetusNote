import { Constellation } from "@/components/ui/constellation";
import { motionTokens } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import * as React from "react";

/** 스플래시와 폴더 선택 화면이 같은 별자리를 이어 쓴다(Motion layoutId) */
export const BRAND_MARK_LAYOUT_ID = "cetus-mark";

type SplashProps = {
  /** 다 보여 줬거나 사용자가 건너뛰었을 때 한 번 */
  onDone: () => void;
  className?: string;
};

/**
 * PG-Splash — 첫 실행 스플래시 (DATA-03, 2026-11-19 사용자 결정 "스플래시 → 폴더 선택").
 * 고래자리 별이 머리부터 하나씩 켜지고, 별빛이 번지며 선이 이어진 뒤 이름이 떠오른다(약 2초).
 * 아무 키나 누르거나 클릭하면 건너뛴다. 동작 줄이기면 애니메이션 없이 잠깐 보여 주고 넘어간다.
 * 빛은 별자리의 radiant 빛만 쓴다(배경 글로우·그라데이션 없음, concept.md).
 */
function Splash({ onDone, className }: SplashProps) {
  const reduced = useReducedMotion();
  const t = motionTokens();
  const [drawn, setDrawn] = React.useState(false);
  const done = React.useRef(false);
  const finish = React.useRef(onDone);
  React.useLayoutEffect(() => {
    finish.current = onDone;
  });
  const end = React.useCallback(() => {
    if (done.current) return;
    done.current = true;
    finish.current();
  }, []);

  // 이름이 뜬 뒤 잠깐 머물렀다 넘어간다 — 별빛이 한 번 번지는 것을 볼 만큼
  React.useEffect(() => {
    if (!drawn) return;
    const id = window.setTimeout(end, t.slow * 4 * 1000);
    return () => window.clearTimeout(id);
  }, [drawn, end, t.slow]);

  // 아무 키·클릭으로 건너뛰기
  React.useEffect(() => {
    const skip = (e: Event) => {
      if (e instanceof KeyboardEvent && (e.metaKey || e.ctrlKey || e.altKey)) return;
      end();
    };
    window.addEventListener("keydown", skip);
    window.addEventListener("pointerdown", skip);
    return () => {
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
    };
  }, [end]);

  return (
    <section
      data-slot="splash"
      aria-label="Cetus Note 시작 화면"
      className={cn("grid min-h-full place-items-center bg-app px-6 py-12", className)}
    >
      <div className="grid justify-items-center gap-6 text-center">
        <motion.div layoutId={BRAND_MARK_LAYOUT_ID} transition={{ duration: t.slow, ease: t.ease }}>
          <Constellation
            size="md"
            tone="strong"
            glow="radiant"
            reveal
            onRevealEnd={() => setDrawn(true)}
          />
        </motion.div>
        <motion.div
          className="grid gap-1"
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: drawn || reduced ? 1 : 0 }}
          transition={{ duration: t.slow, ease: t.ease }}
        >
          <p className="text-h1 font-semibold tracking-tight text-primary">Cetus Note</p>
          <p className="text-ui text-secondary">흩어진 생각을 별자리처럼 잇는 노트</p>
        </motion.div>
        <p role="status" className="sr-only">
          Cetus Note를 여는 중이에요. 아무 키나 누르면 건너뛰어요.
        </p>
      </div>
    </section>
  );
}

export { Splash, type SplashProps };
