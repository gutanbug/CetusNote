import { Button } from "@/components/ui/button";
import { AppLogo } from "@/components/ui/app-logo";
import { ChoiceCards, type ChoiceCardOption } from "@/components/ui/choice-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronLeft } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import {
  guideFor,
  IMPORT_GUIDES,
  type ImportGuide,
  type ImportKind,
} from "@/features/import/apps/guides";
import type { ImportAppId } from "@/features/import/apps/pipeline";
import { importFromApp } from "./import-apps";
import { closeImportAppPicker, useImportAppPicker } from "./import-app-picker";

const KIND_LABEL: Record<ImportKind, string> = { zip: "zip 파일", folder: "폴더" };

/** 「메뉴」 표시를 굵게 보여 준다 */
function withMenus(text: string): ReactNode[] {
  return text.split(/(「[^」]+」)/).map((part, i) =>
    part.startsWith("「") ? (
      <span key={i} className="font-medium text-primary">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

/**
 * 다른 앱에서 가져오기 (DATA-11). 1단계: 앱 카드 고르기 · 2단계: 그 앱의 내보내기 안내와 zip·폴더 고르기.
 * 메인 화면에 하나만 둔다. 안내 내용은 features/import/apps/guides.ts가 원천이다.
 */
export function ImportAppDialog() {
  const open = useImportAppPicker((s) => s.open);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && closeImportAppPicker()}>
      <DialogContent size="lg">
        <ImportAppFlow />
      </DialogContent>
    </Dialog>
  );
}

/** 대화상자가 닫히면 이 안의 상태(고른 앱·단계)도 함께 사라진다 */
function ImportAppFlow() {
  const [picked, setPicked] = useState<ImportAppId | null>(null);
  const [app, setApp] = useState<ImportAppId | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // 단계가 바뀌면 제목으로 포커스를 옮긴다(키보드 사용자가 맥락을 놓치지 않게)
  useEffect(() => {
    headingRef.current?.focus();
  }, [app]);

  const pick = (id: ImportAppId, kind: ImportKind) => {
    closeImportAppPicker();
    void importFromApp(id, kind);
  };

  const options: ChoiceCardOption<ImportAppId>[] = IMPORT_GUIDES.map((g) => ({
    value: g.id,
    icon: <AppLogo app={g.id} />,
    title: g.label,
    description: g.hint,
  }));

  return (
    <>
      {app ? (
        <GuideStep
          guide={guideFor(app)}
          headingRef={headingRef}
          onBack={() => setApp(null)}
          onPick={(kind) => pick(app, kind)}
        />
      ) : (
        <>
          <DialogHeader>
            <DialogTitle ref={headingRef} tabIndex={-1} className="outline-none">
              다른 앱에서 가져오기
            </DialogTitle>
            <DialogDescription>가져올 앱을 골라 주세요.</DialogDescription>
          </DialogHeader>
          <ChoiceCards
            label="가져올 앱"
            options={options}
            value={picked}
            onValueChange={setPicked}
            columns={2}
          />
          <div className="flex justify-end">
            <Button disabled={!picked} onClick={() => picked && setApp(picked)}>
              다음
            </Button>
          </div>
        </>
      )}
    </>
  );
}

function GuideStep({
  guide,
  headingRef,
  onBack,
  onPick,
}: {
  guide: ImportGuide;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onBack: () => void;
  onPick: (kind: ImportKind) => void;
}) {
  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
            <ChevronLeft strokeWidth={1.5} />앱 고르기
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <AppLogo app={guide.id} className="size-5 text-primary" />
          <DialogTitle ref={headingRef} tabIndex={-1} className="outline-none">
            {guide.label}에서 내보내기
          </DialogTitle>
        </div>
        <DialogDescription>
          아래 순서로 내보낸 뒤 {guide.kinds.map((k) => KIND_LABEL[k]).join(" 또는 ")}을 골라
          주세요.
        </DialogDescription>
      </DialogHeader>

      <section aria-labelledby="import-steps" className="grid gap-2">
        <h3 id="import-steps" className="text-label font-semibold text-secondary">
          내보내는 방법
        </h3>
        <ol className="grid list-decimal gap-2 pl-5 text-ui text-primary marker:text-tertiary">
          {guide.steps.map((s, i) => (
            <li key={i}>{withMenus(s)}</li>
          ))}
        </ol>
        {guide.note ? <p className="text-caption text-secondary">{guide.note}</p> : null}
      </section>

      <div className="grid grid-cols-2 gap-4">
        <section aria-labelledby="import-gets" className="grid content-start gap-2">
          <h3 id="import-gets" className="text-label font-semibold text-secondary">
            가져와요
          </h3>
          <ul className="grid list-disc gap-1 pl-4 text-caption text-primary marker:text-tertiary">
            {guide.gets.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="import-misses" className="grid content-start gap-2">
          <h3 id="import-misses" className="text-label font-semibold text-secondary">
            가져오지 않아요
          </h3>
          <ul className="grid list-disc gap-1 pl-4 text-caption text-secondary marker:text-tertiary">
            {guide.misses.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </section>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        {guide.kinds.map((kind, i) => (
          <Button
            key={kind}
            variant={i === 0 ? "primary" : "secondary"}
            onClick={() => onPick(kind)}
          >
            {KIND_LABEL[kind]} 고르기
          </Button>
        ))}
      </div>
    </>
  );
}
