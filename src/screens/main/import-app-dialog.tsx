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
import { useMessages, type Messages } from "@/lib/i18n";

function kindLabel(kind: ImportKind, m: Messages): string {
  return m.settings.importApp.kind[kind];
}

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
  const returnFocus = useImportAppPicker((s) => s.returnFocus);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && closeImportAppPicker()}>
      <DialogContent
        size="lg"
        scrollable
        // 두 단계의 높이를 같게 잡아 단계가 바뀔 때 대화상자가 들썩이지 않게 한다(내용이 더 길면 안에서 스크롤)
        className="min-h-130"
        // 닫으면 연 곳(메뉴·버튼)으로 포커스를 돌린다. 그 자리가 사라졌으면 기본 동작에 맡긴다
        onCloseAutoFocus={(e) => {
          if (returnFocus?.isConnected) {
            e.preventDefault();
            returnFocus.focus();
          }
        }}
      >
        <ImportAppFlow />
      </DialogContent>
    </Dialog>
  );
}

/** 대화상자가 닫히면 이 안의 상태(고른 앱·단계)도 함께 사라진다 */
function ImportAppFlow() {
  const m = useMessages();
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
              {m.settings.importApp.title}
            </DialogTitle>
            <DialogDescription>{m.settings.importApp.pickDesc}</DialogDescription>
          </DialogHeader>
          <ChoiceCards
            label={m.settings.importApp.pickLabel}
            options={options}
            value={picked}
            onValueChange={setPicked}
            columns={2}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={closeImportAppPicker}>
              {m.settings.common.cancel}
            </Button>
            <Button disabled={!picked} onClick={() => picked && setApp(picked)}>
              {m.settings.common.next}
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
  const m = useMessages();
  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
            <ChevronLeft strokeWidth={1.5} />
            {m.settings.importApp.pickBack}
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <AppLogo app={guide.id} className="size-5 text-primary" />
          <DialogTitle ref={headingRef} tabIndex={-1} className="outline-none">
            {m.settings.importApp.exportFrom(guide.label)}
          </DialogTitle>
        </div>
        <DialogDescription>
          {m.settings.importApp.chooseKinds(
            guide.kinds.map((k) => kindLabel(k, m)).join(m.settings.importApp.or),
          )}
        </DialogDescription>
      </DialogHeader>

      <section aria-labelledby="import-steps" className="grid gap-2">
        <h3 id="import-steps" className="text-label font-semibold text-secondary">
          {m.settings.importApp.howTo}
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
            {m.settings.importApp.gets}
          </h3>
          <ul className="grid list-disc gap-1 pl-4 text-caption text-primary marker:text-tertiary">
            {guide.gets.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="import-misses" className="grid content-start gap-2">
          <h3 id="import-misses" className="text-label font-semibold text-secondary">
            {m.settings.importApp.misses}
          </h3>
          <ul className="grid list-disc gap-1 pl-4 text-caption text-secondary marker:text-tertiary">
            {guide.misses.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </section>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={closeImportAppPicker}>
          {m.settings.common.cancel}
        </Button>
        {/* 기본(주 버튼)은 그 앱의 권장 내보내기 형식이다 = guide.kinds[0] (features/import/apps/guides.ts). 나머지는 보조 버튼 */}
        {guide.kinds.map((kind, i) => (
          <Button
            key={kind}
            variant={i === 0 ? "primary" : "secondary"}
            onClick={() => onPick(kind)}
          >
            {m.settings.importApp.pickKind(kindLabel(kind, m))}
          </Button>
        ))}
      </div>
    </>
  );
}
