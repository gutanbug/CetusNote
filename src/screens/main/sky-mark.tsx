import { Constellation } from "@/components/ui/constellation";
import { useSession } from "@/features/session";
import { cn } from "@/lib/utils";

/**
 * 고래자리 한 점 — 홈 · 페이지 · 템플릿 · 빈 화면이 모두 이 컴포넌트로 그린다(concept.md §3).
 * 크기 · 톤 · 빛 · 반짝임은 여기서만 정하고, 화면은 자리(className)만 준다.
 * 설정 › 외관 › 고래자리 보여주기가 꺼져 있으면 아무것도 그리지 않는다.
 */
function SkyMark({ className }: { className?: string }) {
  const on = useSession((s) => s.appearance.constellation);
  if (!on) return null;
  return (
    <Constellation
      size="md"
      tone="strong"
      glow="radiant"
      className={cn("pointer-events-none w-40 shrink-0", className)}
    />
  );
}

export { SkyMark };
