import { AccentSwatchGroup } from "@/components/page/accent-swatch";
import {
  SETTINGS_TABS,
  settingsPanelId,
  settingsTabId,
  type SettingsTab,
} from "@/components/page/options";
import { SettingsNav } from "@/components/page/settings-nav";
import { SettingsRow } from "@/components/page/settings-row";
import { ThemeCardGroup } from "@/components/page/theme-card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { TagChip } from "@/components/ui/tag-chip";
import { toast } from "@/components/ui/toast";
import { backupDate, backupErrorMessage, backupFileName } from "@/features/backup";
import { metaStore, useMeta } from "@/features/meta";
import { pagesStore, usePages } from "@/features/pages";
import { sessionStore, useSession, type FontScale, type StartScreen } from "@/features/session";
import { useWorkspace, workspaceStore } from "@/features/workspace";
import type { PageFont, RecordOpenMode } from "@/lib/storage";
import { getStorage } from "@/lib/storage/default";
import { restoreBuiltinTemplates } from "./actions";
import { importDocuments } from "./import-document";
import { exportWorkspaceMarkdown } from "./export-workspace";
import { canReveal, revealInFinder } from "@/lib/storage/open-link";
import { ScrollArea } from "@/components/ui/scroll-area";
import * as React from "react";
import { ZOOM_STEPS } from "@/lib/zoom";
import { SHORTCUT_GROUPS } from "./shortcuts";
import { useRestoreFocus } from "./use-restore-focus";
import { useMainUi } from "./ui-store";
import { TagItem } from "@/components/shell/tag-item";
import { countTags, tagColor } from "./tag-colors";
import { openTagMenuAt, openTagMenuFromKey, useTagUi } from "./tag-ui";

const ID = "settings";

/** 설정 (SET-01–03) — 왼쪽 탭(PG-SettingsNav) + 오른쪽 행(PG-SettingsRow). 프로토타입 `.settings` 860×560 */
export function SettingsDialog() {
  const open = useMainUi((s) => s.settingsOpen);
  const setOpen = useMainUi((s) => s.setSettingsOpen);
  const askedTab = useMainUi((s) => s.settingsTab);
  const [tab, setTab] = React.useState<SettingsTab>("general");
  // 열 때마다 요청한 탭(없으면 일반)에서 시작한다 — 렌더 중에 이전 값과 비교해 맞춘다
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setTab(askedTab ?? "general");
  }
  useRestoreFocus(open);
  const current = SETTINGS_TABS.find((t) => t.id === tab)!;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        size={null}
        className="grid h-140 w-215 max-w-[calc(var(--fit-w)-var(--s8))] grid-cols-[calc(var(--spacing)*50)_minmax(0,1fr)] gap-0 overflow-hidden p-0"
      >
        {/* PG-SettingsNav가 왼쪽 칸의 배경·구분선을 스스로 그린다 */}
        <SettingsNav value={tab} onValueChange={setTab} idPrefix={ID} />
        <div className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)]">
          <div className="flex items-center gap-2 border-b border-line px-6 py-4">
            <DialogTitle>{current.name}</DialogTitle>
            <DialogDescription className="sr-only">Cetus Note 설정</DialogDescription>
          </div>
          {/* 내용이 넘치면 스크롤 막대를 늘 보인다(목록이 아래로 이어진다는 표시) · 내려가면 위에 구분선 */}
          <ScrollArea type="auto" className="min-h-0">
            <div
              role="tabpanel"
              id={settingsPanelId(ID, tab)}
              aria-labelledby={settingsTabId(ID, tab)}
              className="p-6"
            >
              {tab === "general" ? (
                <General />
              ) : tab === "appearance" ? (
                <Appearance />
              ) : tab === "shortcuts" ? (
                <Shortcuts />
              ) : tab === "editor" ? (
                <Editor />
              ) : tab === "data" ? (
                <Data onRestored={() => setOpen(false)} />
              ) : (
                <p className="text-ui text-tertiary">준비 중이에요.</p>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** 컬렉션 레코드 여는 기본 방식 (COLL-07) — 컬렉션마다 툴바에서 바꿀 수 있다 */
function RecordOpenRow() {
  const mode = useSession((s) => s.recordOpen);
  return (
    <SettingsRow
      name="레코드 열기"
      description="컬렉션에서 레코드를 누르면 여는 방식이에요. 컬렉션마다 툴바에서 바꿀 수 있어요."
    >
      <Segmented
        label="레코드 열기"
        options={[
          { value: "modal", label: "모달" },
          { value: "side", label: "사이드 패널" },
          { value: "tab", label: "새 탭" },
        ]}
        value={mode}
        onValueChange={(v) => sessionStore.getState().setRecordOpen(v as RecordOpenMode)}
      />
    </SettingsRow>
  );
}

/** 에디터 (SET-04) — 새 페이지 글꼴 · 맞춤법 검사 · 완료 항목 흐리게 + 늘 켜진 입력 도구 안내 (프로토타입 에디터 탭) */
function Editor() {
  const e = useSession((s) => s.editor);
  const set = sessionStore.getState().setEditor;
  const always = <TagChip color="green">항상 켜짐</TagChip>;
  return (
    <div>
      <SettingsRow
        name="새 페이지 글꼴"
        description="새로 만드는 페이지의 본문 글꼴이에요. 페이지마다 ··· 메뉴에서 바꿀 수 있어요."
      >
        <Segmented
          label="새 페이지 글꼴"
          options={[
            { value: "default", label: "기본" },
            { value: "serif", label: "세리프" },
            { value: "mono", label: "모노" },
          ]}
          value={e.newPageFont}
          onValueChange={(v) => set({ newPageFont: v as PageFont })}
        />
      </SettingsRow>
      <SettingsRow
        name="맞춤법 검사"
        description="본문에서 틀린 낱말 아래에 밑줄을 그어요. 시스템 맞춤법 검사기를 써요."
        controlId="spellcheck"
      >
        <Switch
          id="spellcheck"
          aria-describedby="spellcheck-desc"
          checked={e.spellcheck}
          onCheckedChange={(spellcheck) => set({ spellcheck })}
        />
      </SettingsRow>
      <SettingsRow
        name="완료한 체크 항목 흐리게"
        description="체크한 할 일을 회색과 취소선으로 보여요."
        controlId="dim-checked"
      >
        <Switch
          id="dim-checked"
          aria-describedby="dim-checked-desc"
          checked={e.dimChecked}
          onCheckedChange={(dimChecked) => set({ dimChecked })}
        />
      </SettingsRow>
      <RecordOpenRow />
      <SettingsRow
        name="마크다운 단축 입력"
        description={
          <>
            줄 맨 앞에 쓰면 블록으로 바뀌어요: <code className="font-mono">#</code>{" "}
            <code className="font-mono">-</code> <code className="font-mono">[]</code>{" "}
            <code className="font-mono">&gt;</code> <code className="font-mono">```</code>
          </>
        }
      >
        {always}
      </SettingsRow>
      <SettingsRow
        name="슬래시 명령"
        description={
          <>
            본문에서 <code className="font-mono">/</code> 키를 누르면 블록 메뉴가 열려요.
          </>
        }
      >
        {always}
      </SettingsRow>
    </div>
  );
}

/** 데이터 / 백업 (SET-06, DATA-05) — 내보내기 · 자동 백업 · 불러오기(새 폴더로) */
function Data({ onRestored }: { onRestored: () => void }) {
  const folderName = useWorkspace((s) => s.workspace?.name ?? "");
  const metaName = useMeta((s) => s.meta?.name ?? "");
  const auto = useSession((s) => s.autoBackup);
  const restoring = useWorkspace((s) => s.busy === "restore");
  const [exporting, setExporting] = React.useState(false);
  const [last, setLast] = React.useState<string | null | undefined>();

  React.useEffect(() => {
    let alive = true;
    getStorage()
      .listBackups()
      .then((list) => alive && setLast(list.map(backupDate).find(Boolean) ?? null))
      .catch(() => alive && setLast(null));
    return () => {
      alive = false;
    };
  }, []);

  // 남은 저장을 먼저 끝내야 백업에 마지막 글이 들어가고, 다른 폴더로 바뀌기 전에 지금 폴더에 쓴다
  const flush = () =>
    Promise.all([
      pagesStore.getState().flushAll(),
      metaStore.getState().flush(),
      sessionStore.getState().flush(),
    ]);

  const exportNow = async () => {
    setExporting(true);
    try {
      await flush();
      const now = new Date();
      const saved = await getStorage().exportBackup(
        backupFileName(metaName || folderName, now),
        now.toISOString(),
      );
      if (saved) toast(`“${saved}” 파일로 백업했어요.`);
    } catch (e) {
      toast.error(backupErrorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  const restore = async () => {
    try {
      await flush();
      if (await workspaceStore.getState().restore()) {
        onRestored();
        toast("백업을 새 폴더에 풀어 열었어요.");
      }
    } catch (e) {
      toast.error(backupErrorMessage(e));
    }
  };

  return (
    <div className="grid gap-6">
      <DataSection id="data-backup" title="백업">
        <SettingsRow
          name="백업 내보내기"
          description="페이지, 이미지, 워크스페이스 설정을 zip 파일 하나로 저장해요."
        >
          <Button
            variant="secondary"
            size="sm"
            loading={exporting}
            onClick={() => void exportNow()}
          >
            내보내기…
          </Button>
        </SettingsRow>
        <SettingsRow
          name="백업 불러오기"
          description="백업 파일을 새 폴더에 풀고 그 폴더를 열어요. 지금 워크스페이스는 그대로 남아요."
        >
          <Button variant="secondary" size="sm" loading={restoring} onClick={() => void restore()}>
            불러오기…
          </Button>
        </SettingsRow>
        <SettingsRow
          name="자동 백업"
          description={
            <>
              앱을 켤 때 하루 한 번 워크스페이스의 .backups 폴더에 저장하고, 최근 7개만 남겨요.
              {last !== undefined ? (
                <span className="block">
                  {last ? `마지막 자동 백업: ${last}` : "아직 자동 백업이 없어요."}
                </span>
              ) : null}
            </>
          }
          controlId="auto-backup"
        >
          <Switch
            id="auto-backup"
            aria-describedby="auto-backup-desc"
            checked={auto}
            onCheckedChange={(on) => sessionStore.getState().setAutoBackup(on)}
          />
        </SettingsRow>
        {canReveal() ? (
          <SettingsRow name="자동 백업 폴더" description="백업 zip이 쌓이는 폴더를 열어요.">
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                void getStorage()
                  .revealBackups()
                  .catch(() => toast.error("폴더를 열지 못했어요."))
              }
            >
              Finder에서 보기
            </Button>
          </SettingsRow>
        ) : null}
      </DataSection>
      <DataSection id="data-transfer" title="가져오기·내보내기">
        <SettingsRow
          name="문서 가져오기"
          description="md, txt, html, docx, pdf 파일을 고르면 파일마다 새 문서로 만들어요. PDF는 글자만 가져와요. 같은 폴더 안의 이미지도 함께 가져와요."
        >
          <Button variant="secondary" size="sm" onClick={() => void importDocuments()}>
            가져오기…
          </Button>
        </SettingsRow>
        <SettingsRow
          name="Markdown으로 모두 내보내기"
          description="모든 문서를 폴더 구조대로 .md 파일로 만들어요. 본문 이미지는 assets 폴더에 함께 넣어요."
        >
          <Button variant="secondary" size="sm" onClick={() => void exportWorkspaceMarkdown()}>
            내보내기…
          </Button>
        </SettingsRow>
      </DataSection>
      <DataSection id="data-templates" title="템플릿">
        <SettingsRow
          name="기본 템플릿 되살리기"
          description="지운 기본 템플릿(회의록 · 일일 노트 …)을 템플릿 갤러리에 다시 넣어요. 고친 템플릿은 그대로예요."
        >
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const n = restoreBuiltinTemplates();
              toast(n ? `기본 템플릿 ${n}개를 되살렸어요.` : "기본 템플릿이 모두 있어요.");
            }}
          >
            되살리기
          </Button>
        </SettingsRow>
      </DataSection>
    </div>
  );
}

/** 데이터 / 백업 화면의 묶음 — 단축키 화면과 같은 작은 제목 아래에 행을 모은다 */
function DataSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id}>
      <h3
        id={id}
        className="pb-1 text-label font-semibold tracking-(--tracking-label) text-tertiary"
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

/** 단축키 (SET-05) — 읽기 전용 목록. 바꾸기는 지원하지 않는다 */
function Shortcuts() {
  return (
    <div className="grid gap-6">
      {SHORTCUT_GROUPS.map((g) => (
        <section key={g.title} aria-labelledby={`sc-${g.title}`}>
          <h3
            id={`sc-${g.title}`}
            className="pb-1 text-label font-semibold tracking-(--tracking-label) text-tertiary"
          >
            {g.title}
          </h3>
          <ul>
            {g.items.map((it) => (
              <li
                key={it.name}
                className="flex items-center justify-between gap-4 border-b border-line py-2 text-ui text-primary last:border-b-0"
              >
                <span>{it.name}</span>
                <Kbd keys={it.keys} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function General() {
  const folderName = useWorkspace((s) => s.workspace?.name ?? "");
  const path = useWorkspace((s) => s.workspace?.path ?? "");
  const metaName = useMeta((s) => s.meta?.name ?? "");
  const startScreen = useSession((s) => s.startScreen);
  const [name, setName] = React.useState(metaName || folderName);
  const commit = () => metaStore.getState().setName(name.trim());
  // Esc 등으로 창이 닫히면 blur 없이 언마운트되므로, 닫힐 때도 입력값을 저장한다
  const commitRef = React.useRef(commit);
  React.useEffect(() => {
    commitRef.current = commit;
  });
  React.useEffect(() => () => commitRef.current(), []);
  return (
    <div>
      <SettingsRow
        name="워크스페이스 이름"
        description="사이드바 위에 보여요. 비우면 폴더 이름을 써요."
        controlId="ws-name"
      >
        <Input
          id="ws-name"
          aria-describedby="ws-name-desc"
          value={name}
          placeholder={folderName}
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && commit()}
          className="w-50"
        />
      </SettingsRow>
      <SettingsRow
        name="시작 화면"
        description="앱을 켜거나 다른 폴더를 열었을 때 처음 보이는 화면이에요."
      >
        <Segmented
          label="시작 화면"
          options={[
            { value: "home", label: "홈" },
            { value: "last", label: "마지막 페이지" },
          ]}
          value={startScreen}
          onValueChange={(v) => sessionStore.getState().setStartScreen(v as StartScreen)}
        />
      </SettingsRow>
      <SettingsRow
        name="저장 위치"
        description={<span className="font-mono break-all">{path}</span>}
      >
        {canReveal() ? (
          <Button variant="secondary" size="sm" onClick={() => void revealInFinder(path)}>
            Finder에서 보기
          </Button>
        ) : null}
      </SettingsRow>
      <TagSettings />
    </div>
  );
}

/** 태그 관리 (SHELL-18) — 모든 태그를 개수·색과 함께 보여 주고, 행을 누르거나 우클릭하면 같은 메뉴가 열린다 */
function TagSettings() {
  const pages = usePages((s) => s.pages);
  const colors = useMeta((s) => s.meta?.tags);
  const tags = React.useMemo(
    () => countTags(Object.values(pages).filter((p) => p.kind === "page")),
    [pages],
  );
  return (
    <section aria-labelledby="settings-tags-title" className="border-t border-line pt-4">
      <h3 id="settings-tags-title" tabIndex={-1} className="text-ui font-medium">
        태그
      </h3>
      <p className="mt-1 text-caption text-tertiary">
        이름 바꾸기 · 색 · 합치기 · 삭제는 모든 문서에 한 번에 적용돼요.
      </p>
      {tags.length ? (
        <ul className="mt-3 grid gap-0.5" aria-label="태그 목록">
          {tags.map(([tag, count]) => (
            <li key={tag}>
              <TagItem
                data-tag-anchor={tag}
                name={tag}
                color={tagColor(colors?.[tag])}
                count={count}
                aria-haspopup="menu"
                onClick={(e) => openTagMenuAt(tag, e.currentTarget)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  useTagUi.getState().openMenu(tag, e.clientX, e.clientY, e.currentTarget);
                }}
                onKeyDown={(e) => openTagMenuFromKey(tag, e)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-ui text-tertiary">태그가 아직 없어요.</p>
      )}
    </section>
  );
}

const SCALES: { value: string; label: string }[] = [
  { value: "0.9", label: "작게" },
  { value: "1", label: "기본" },
  { value: "1.1", label: "크게" },
];

function Appearance() {
  const a = useSession((s) => s.appearance);
  const set = sessionStore.getState().setAppearance;
  return (
    <div>
      <SettingsRow stacked name="테마" description="시스템을 고르면 OS 설정을 따라요.">
        <ThemeCardGroup value={a.theme} onValueChange={(theme) => set({ theme })} />
      </SettingsRow>
      <SettingsRow stacked name="포인트 색" description="링크, 선택, 포커스 표시에 쓰여요.">
        <AccentSwatchGroup value={a.accent} onValueChange={(accent) => set({ accent })} />
      </SettingsRow>
      <SettingsRow name="글꼴 크기" description="본문과 제목에 적용돼요.">
        <Segmented
          label="글꼴 크기"
          options={SCALES}
          value={String(a.fontScale)}
          onValueChange={(v) => set({ fontScale: Number(v) as FontScale })}
        />
      </SettingsRow>
      <SettingsRow
        name="화면 크기"
        description="앱 전체를 키우거나 줄여요. ⌘+ ⌘− ⌘0으로도 바꿀 수 있어요."
      >
        <Segmented
          label="화면 크기"
          options={ZOOM_STEPS.map((z) => ({ value: String(z), label: `${Math.round(z * 100)}%` }))}
          value={String(a.zoom)}
          onValueChange={(v) => set({ zoom: Number(v) })}
        />
      </SettingsRow>
      <SettingsRow
        name="새 페이지 본문 폭"
        description="페이지마다 ··· 메뉴의 전체 폭으로 바꿀 수 있어요."
      >
        <Segmented
          label="새 페이지 본문 폭"
          options={[
            { value: "default", label: "기본" },
            { value: "wide", label: "전체 폭" },
          ]}
          value={a.newPageWide ? "wide" : "default"}
          onValueChange={(v) => set({ newPageWide: v === "wide" })}
        />
      </SettingsRow>
      <SettingsRow
        name="배경 별자리"
        description="페이지 오른쪽 여백에 고래자리를 옅게 그려요."
        controlId="sky"
      >
        <Switch
          id="sky"
          aria-describedby="sky-desc"
          checked={a.constellation}
          onCheckedChange={(constellation) => set({ constellation })}
        />
      </SettingsRow>
    </div>
  );
}
