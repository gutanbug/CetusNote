import { FileText, LayoutTemplate } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

type EmptyStartProps = {
  /** "빈 페이지로 시작" — 본문 첫 줄로 간다 */
  onStartBlank: () => void;
  /** "템플릿에서 시작" — 템플릿 갤러리를 연다 (P1, PAGE-07). 없으면 버튼을 숨긴다 */
  onOpenTemplates?: () => void;
  className?: string;
};

/** PG-EmptyStart — 빈 페이지에서 시작 방법 고르기 (프로토타입 `.empty-start`). */
function EmptyStart({ onStartBlank, onOpenTemplates, className }: EmptyStartProps) {
  return (
    <div data-slot="empty-start" className={cn("mt-6 grid gap-3", className)}>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onStartBlank}>
          <FileText strokeWidth={1.5} aria-hidden />빈 페이지로 시작
        </Button>
        {onOpenTemplates ? (
          <Button variant="secondary" onClick={onOpenTemplates}>
            <LayoutTemplate strokeWidth={1.5} aria-hidden />
            템플릿에서 시작
          </Button>
        ) : null}
      </div>
      <p className="mt-2 flex items-center gap-2 text-caption text-tertiary">
        본문에서 <Kbd keys={["/"]} />를 입력하면 블록 메뉴가 열려요.
      </p>
    </div>
  );
}

export { EmptyStart, type EmptyStartProps };
