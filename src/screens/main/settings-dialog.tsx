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
import { McpStatus } from "@/components/page/mcp-status";
import { mcpDetail, type McpStatusValue } from "@/components/page/mcp-status-model";
import { StatusChip } from "@/components/ui/status-chip";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeaderRow,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Segmented } from "@/components/ui/segmented";
import type { AppIconPref } from "@/lib/app-icon";
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
import { UpdateSection } from "./update-section";
import { LOCALE_NAMES, useMessages, type LanguagePref, type Messages } from "@/lib/i18n";
import { restoreBuiltinTemplates } from "./actions";
import { importDocuments } from "./import-document";
import { openImportAppPicker } from "./import-app-picker";
import { exportWorkspaceMarkdown } from "./export-workspace";
import { frontMatterPref, setFrontMatterPref } from "@/features/export/prefs";
import { canReveal, revealInFinder } from "@/lib/storage/open-link";
import { currentPlatform, revealLabel } from "@/lib/platform-labels";
import { ScrollArea } from "@/components/ui/scroll-area";
import * as React from "react";
import { ZOOM_STEPS } from "@/lib/zoom";
import { shortcutGroups } from "./shortcuts";
import { useRestoreFocus } from "./use-restore-focus";
import { useMainUi } from "./ui-store";
import { TagItem } from "@/components/shell/tag-item";
import { countTags, tagColor } from "./tag-colors";
import { openTagMenuAt, openTagMenuFromKey, useTagUi } from "./tag-ui";
import { QuickInputSettings } from "./quick-input-settings";

const ID = "settings";

/** 설정 (SET-01–03) — 왼쪽 탭(PG-SettingsNav) + 오른쪽 행(PG-SettingsRow). 프로토타입 `.settings` 860×560 */
export function SettingsDialog() {
  const m = useMessages();
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
          <DialogHeaderRow className="border-b border-line">
            <DialogTitle>{current.name}</DialogTitle>
            <DialogDescription className="sr-only">
              {m.settings.dialog.srDescription}
            </DialogDescription>
          </DialogHeaderRow>
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
              ) : tab === "agent" ? (
                <AgentSettings />
              ) : (
                <p className="text-ui text-tertiary">{m.settings.dialog.comingSoon}</p>
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
  const m = useMessages();
  const mode = useSession((s) => s.recordOpen);
  return (
    <SettingsRow name={m.settings.recordOpen.name} description={m.settings.recordOpen.description}>
      <Segmented
        label={m.settings.recordOpen.label}
        options={[
          { value: "modal", label: m.settings.recordOpen.modal },
          { value: "side", label: m.settings.recordOpen.side },
          { value: "tab", label: m.settings.recordOpen.tab },
        ]}
        value={mode}
        onValueChange={(v) => sessionStore.getState().setRecordOpen(v as RecordOpenMode)}
      />
    </SettingsRow>
  );
}

/** 에디터 (SET-04) — 새 페이지 글꼴 · 맞춤법 검사 · 완료 항목 흐리게 + 늘 켜진 입력 도구 안내 (프로토타입 에디터 탭) */
function Editor() {
  const m = useMessages();
  const e = useSession((s) => s.editor);
  const set = sessionStore.getState().setEditor;
  const always = <TagChip color="green">{m.settings.editor.alwaysOn}</TagChip>;
  return (
    <div>
      <SettingsRow
        name={m.settings.editor.newPageFontName}
        description={m.settings.editor.newPageFontDesc}
      >
        <Segmented
          label={m.settings.editor.newPageFontLabel}
          options={[
            { value: "default", label: m.settings.editor.fontDefault },
            { value: "serif", label: m.settings.editor.fontSerif },
            { value: "mono", label: m.settings.editor.fontMono },
          ]}
          value={e.newPageFont}
          onValueChange={(v) => set({ newPageFont: v as PageFont })}
        />
      </SettingsRow>
      <SettingsRow
        name={m.settings.editor.spellcheckName}
        description={m.settings.editor.spellcheckDesc}
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
        name={m.settings.editor.dimCheckedName}
        description={m.settings.editor.dimCheckedDesc}
        controlId="dim-checked"
      >
        <Switch
          id="dim-checked"
          aria-describedby="dim-checked-desc"
          checked={e.dimChecked}
          onCheckedChange={(dimChecked) => set({ dimChecked })}
        />
      </SettingsRow>
      <SettingsRow
        name={m.settings.editor.calcName}
        description={
          <>
            {m.settings.editor.calcBefore}
            <code className="font-mono">=</code>
            {m.settings.editor.calcAfter}
            <code className="font-mono">{m.settings.editor.calcExample}</code>
          </>
        }
        controlId="calc-lines"
      >
        <Switch
          id="calc-lines"
          aria-describedby="calc-lines-desc"
          checked={e.calc}
          onCheckedChange={(calc) => set({ calc })}
        />
      </SettingsRow>
      <SettingsRow
        name={m.settings.editor.calcRightName}
        description={m.settings.editor.calcRightDesc}
        controlId="calc-right"
      >
        <Switch
          id="calc-right"
          aria-describedby="calc-right-desc"
          checked={e.calcRight}
          disabled={!e.calc}
          onCheckedChange={(calcRight) => set({ calcRight })}
        />
      </SettingsRow>
      <RecordOpenRow />
      <SettingsRow
        name={m.settings.editor.markdownName}
        description={
          <>
            {m.settings.editor.markdownDesc} <code className="font-mono">#</code>{" "}
            <code className="font-mono">-</code> <code className="font-mono">[]</code>{" "}
            <code className="font-mono">&gt;</code> <code className="font-mono">```</code>
          </>
        }
      >
        {always}
      </SettingsRow>
      <SettingsRow
        name={m.settings.editor.slashName}
        description={
          <>
            {m.settings.editor.slashBefore}
            <code className="font-mono">/</code>
            {m.settings.editor.slashAfter}
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
  const m = useMessages();
  const folderName = useWorkspace((s) => s.workspace?.name ?? "");
  const metaName = useMeta((s) => s.meta?.name ?? "");
  const auto = useSession((s) => s.autoBackup);
  const restoring = useWorkspace((s) => s.busy === "restore");
  const [exporting, setExporting] = React.useState(false);
  const [last, setLast] = React.useState<string | null | undefined>();
  const [frontMatter, setFrontMatter] = React.useState(frontMatterPref);

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
      if (saved) toast(m.settings.data.backedUp(saved));
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
        toast(m.settings.data.restored);
      }
    } catch (e) {
      toast.error(backupErrorMessage(e));
    }
  };

  return (
    <div className="grid gap-6">
      <DataSection id="data-backup" title={m.settings.data.sectionBackup}>
        <SettingsRow name={m.settings.data.exportName} description={m.settings.data.exportDesc}>
          <Button
            variant="secondary"
            size="sm"
            loading={exporting}
            onClick={() => void exportNow()}
          >
            {m.settings.data.exportButton}
          </Button>
        </SettingsRow>
        <SettingsRow name={m.settings.data.restoreName} description={m.settings.data.restoreDesc}>
          <Button variant="secondary" size="sm" loading={restoring} onClick={() => void restore()}>
            {m.settings.data.restoreButton}
          </Button>
        </SettingsRow>
        <SettingsRow
          name={m.settings.data.autoName}
          description={
            <>
              {m.settings.data.autoDesc}
              {last !== undefined ? (
                <span className="block">
                  {last ? m.settings.data.autoLast(last) : m.settings.data.autoNone}
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
          <SettingsRow
            name={m.settings.data.autoFolderName}
            description={m.settings.data.autoFolderDesc}
          >
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                void getStorage()
                  .revealBackups()
                  .catch(() => toast.error(m.settings.data.openFolderFail))
              }
            >
              {revealLabel(currentPlatform())}
            </Button>
          </SettingsRow>
        ) : null}
      </DataSection>
      <DataSection id="data-transfer" title={m.settings.data.sectionTransfer}>
        <SettingsRow
          name={m.settings.data.docImportName}
          description={m.settings.data.docImportDesc}
        >
          <Button variant="secondary" size="sm" onClick={() => void importDocuments()}>
            {m.settings.data.importButton}
          </Button>
        </SettingsRow>
        <SettingsRow
          name={m.settings.data.appImportName}
          description={m.settings.data.appImportDesc}
        >
          <Button variant="secondary" size="sm" onClick={() => openImportAppPicker()}>
            {m.settings.data.importButton}
          </Button>
        </SettingsRow>
        <SettingsRow name={m.settings.data.mdExportName} description={m.settings.data.mdExportDesc}>
          <Button variant="secondary" size="sm" onClick={() => void exportWorkspaceMarkdown()}>
            {m.settings.data.exportButton}
          </Button>
        </SettingsRow>
        <SettingsRow
          name={m.settings.data.frontMatterName}
          description={m.settings.data.frontMatterDesc}
          controlId="front-matter"
        >
          <Switch
            id="front-matter"
            aria-describedby="front-matter-desc"
            checked={frontMatter}
            onCheckedChange={(on) => {
              setFrontMatter(on);
              setFrontMatterPref(on);
            }}
          />
        </SettingsRow>
      </DataSection>
      <DataSection id="data-templates" title={m.settings.data.sectionTemplates}>
        <SettingsRow
          name={m.settings.data.templatesRestoreName}
          description={m.settings.data.templatesRestoreDesc}
        >
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const n = restoreBuiltinTemplates();
              toast(n ? m.settings.data.restoredTemplates(n) : m.settings.data.allTemplatesPresent);
            }}
          >
            {m.settings.data.templatesButton}
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
  const m = useMessages();
  return (
    <div className="grid gap-6">
      {shortcutGroups(m.screens.shortcuts).map((g) => (
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
  const m = useMessages();
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
        name={m.settings.general.workspaceName}
        description={m.settings.general.workspaceNameDesc}
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
      <LanguageRow />
      <SettingsRow
        name={m.settings.general.startScreen}
        description={m.settings.general.startScreenDesc}
      >
        <Segmented
          label={m.settings.general.startScreen}
          options={[
            { value: "home", label: m.settings.general.startHome },
            { value: "last", label: m.settings.general.startLast },
          ]}
          value={startScreen}
          onValueChange={(v) => sessionStore.getState().setStartScreen(v as StartScreen)}
        />
      </SettingsRow>
      <SettingsRow
        name={m.settings.general.storageLocation}
        description={<span className="font-mono break-all">{path}</span>}
      >
        {canReveal() ? (
          <Button variant="secondary" size="sm" onClick={() => void revealInFinder(path)}>
            {revealLabel(currentPlatform())}
          </Button>
        ) : null}
      </SettingsRow>
      <QuickInputSettings />
      <UpdateSection />
      <TagSettings />
    </div>
  );
}

/** MCP 상태를 몇 초마다 다시 읽는다 — AI 도구가 연결하거나 끊으면 뱃지가 따라 바뀐다 */
const MCP_POLL_MS = 3000;

function useMcpStatus(): McpStatusValue | null {
  const [status, setStatus] = React.useState<McpStatusValue | null>(null);
  React.useEffect(() => {
    let alive = true;
    const read = () =>
      getStorage()
        .mcpStatus()
        .then((s) => {
          if (!alive) return;
          const clients = s.sessions.map((x) => x.client);
          setStatus((prev) =>
            prev &&
            prev.claudeCode === s.claudeCode &&
            prev.claudeDesktop === s.claudeDesktop &&
            prev.clients.join("\n") === clients.join("\n")
              ? prev
              : { clients, claudeCode: s.claudeCode, claudeDesktop: s.claudeDesktop },
          );
        })
        .catch(() => alive && setStatus({ clients: [], claudeCode: false, claudeDesktop: false }));
    void read();
    const id = window.setInterval(read, MCP_POLL_MS);
    window.addEventListener("focus", read);
    return () => {
      alive = false;
      window.clearInterval(id);
      window.removeEventListener("focus", read);
    };
  }, []);
  return status;
}

/**
 * Agent / MCP (DATA-12). MCP 서버 연결 상태와 등록 방법, 그리고 앞으로 넣을 개인 AI 에이전트·API 키 자리.
 * 에이전트 연결(검색·내용 분석)은 아직 없다 — 준비 중이라고만 알린다.
 */
function AgentSettings() {
  const m = useMessages();
  const status = useMcpStatus();
  return (
    <div className="grid gap-6">
      <section aria-labelledby="settings-mcp-title">
        <h3 id="settings-mcp-title" className="text-ui font-medium">
          {m.settings.agent.mcpTitle}
        </h3>
        <p className="mt-1 text-caption text-tertiary">{m.settings.agent.mcpDesc}</p>
        <SettingsRow name={m.settings.agent.statusName} description={mcpDetail(status)}>
          <McpStatus status={status} />
        </SettingsRow>
        <McpRow />
      </section>
      <section aria-labelledby="settings-agent-title" className="border-t border-line pt-4">
        <h3 id="settings-agent-title" className="text-ui font-medium">
          {m.settings.agent.aiTitle}
        </h3>
        <SettingsRow name={m.settings.agent.keyName} description={m.settings.agent.keyDesc}>
          <StatusChip status={m.settings.agent.preparing} color="gray" />
        </SettingsRow>
      </section>
    </div>
  );
}

/** AI 연결(MCP, DATA-12): 앱 실행 파일을 `--mcp`로 실행하는 명령을 복사한다. 워크스페이스는 앱이 마지막으로 연 곳 */
function McpRow() {
  const m = useMessages();
  const [path, setPath] = React.useState<string | null>(null);
  React.useEffect(() => {
    let alive = true;
    getStorage()
      .appExecutablePath()
      .then((p) => alive && setPath(p))
      .catch(() => alive && setPath(""));
    return () => {
      alive = false;
    };
  }, []);
  const ready = Boolean(path);
  // 경로에 " $ ` \ 가 있어도 셸이 그대로 읽게 (Windows 경로에는 "가 올 수 없다)
  const quoted = `"${(path ?? "").replace(/(["$`\\])/g, "\\$1")}"`;
  const command = ready ? `claude mcp add cetusnote -- ${quoted} --mcp` : "";
  const desktop = ready
    ? JSON.stringify({ mcpServers: { cetusnote: { command: path, args: ["--mcp"] } } }, null, 2)
    : "";
  const copy = async (text: string, done: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(done);
    } catch {
      toast(m.settings.agent.copyFail);
    }
  };
  return (
    <SettingsRow
      name={m.settings.agent.registerName}
      description={m.settings.agent.registerDesc}
      stacked
    >
      <div className="grid gap-2">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            // 경로를 찾는 동안에도 키보드로 닿아 안내를 읽을 수 있게 disabled 대신 aria-disabled
            aria-disabled={!ready}
            className="aria-disabled:opacity-40"
            aria-describedby={ready ? undefined : "mcp-hint"}
            onClick={() => ready && void copy(command, m.settings.agent.copiedCommand)}
          >
            {m.settings.agent.copyCommand}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            // 경로를 찾는 동안에도 키보드로 닿아 안내를 읽을 수 있게 disabled 대신 aria-disabled
            aria-disabled={!ready}
            className="aria-disabled:opacity-40"
            aria-describedby={ready ? undefined : "mcp-hint"}
            onClick={() => ready && void copy(desktop, m.settings.agent.copiedDesktop)}
          >
            {m.settings.agent.copyDesktop}
          </Button>
        </div>
        {ready ? null : (
          <p id="mcp-hint" className="text-caption text-secondary">
            {path === null ? m.settings.agent.pathChecking : m.settings.agent.pathMissing}
          </p>
        )}
        {ready ? (
          <code className="font-mono text-caption break-all text-secondary">{command}</code>
        ) : null}
      </div>
    </SettingsRow>
  );
}

/** 태그 관리 (SHELL-18) — 모든 태그를 개수·색과 함께 보여 주고, 행을 누르거나 우클릭하면 같은 메뉴가 열린다 */
function TagSettings() {
  const m = useMessages();
  const pages = usePages((s) => s.pages);
  const colors = useMeta((s) => s.meta?.tags);
  const tags = React.useMemo(
    () => countTags(Object.values(pages).filter((p) => p.kind === "page")),
    [pages],
  );
  return (
    <section aria-labelledby="settings-tags-title" className="border-t border-line pt-4">
      <h3 id="settings-tags-title" tabIndex={-1} className="text-ui font-medium">
        {m.settings.tags.title}
      </h3>
      <p className="mt-1 text-caption text-tertiary">{m.settings.tags.desc}</p>
      {tags.length ? (
        <ul className="mt-3 grid gap-0.5" aria-label={m.settings.tags.list}>
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
        <p className="mt-3 text-ui text-tertiary">{m.settings.tags.empty}</p>
      )}
    </section>
  );
}

function appIconOptions(m: Messages): { value: AppIconPref; label: string }[] {
  return [
    { value: "auto", label: m.settings.appearance.iconAuto },
    { value: "light", label: m.settings.appearance.iconLight },
    { value: "dark", label: m.settings.appearance.iconDark },
  ];
}

function scaleOptions(m: Messages): { value: string; label: string }[] {
  return [
    { value: "0.9", label: m.settings.appearance.scaleSmall },
    { value: "1", label: m.settings.appearance.scaleDefault },
    { value: "1.1", label: m.settings.appearance.scaleLarge },
  ];
}

function Appearance() {
  const m = useMessages();
  const a = useSession((s) => s.appearance);
  const set = sessionStore.getState().setAppearance;
  return (
    <div>
      <SettingsRow
        stacked
        name={m.settings.appearance.theme}
        description={m.settings.appearance.themeDesc}
      >
        <ThemeCardGroup value={a.theme} onValueChange={(theme) => set({ theme })} />
      </SettingsRow>
      <SettingsRow
        stacked
        name={m.settings.appearance.accent}
        description={m.settings.appearance.accentDesc}
      >
        <AccentSwatchGroup value={a.accent} onValueChange={(accent) => set({ accent })} />
      </SettingsRow>
      <SettingsRow
        name={m.settings.appearance.appIcon}
        description={m.settings.appearance.appIconDesc}
      >
        <Segmented
          label={m.settings.appearance.appIcon}
          options={appIconOptions(m)}
          value={a.appIcon}
          onValueChange={(v) => set({ appIcon: v as AppIconPref })}
        />
      </SettingsRow>
      <SettingsRow
        name={m.settings.appearance.fontScale}
        description={m.settings.appearance.fontScaleDesc}
      >
        <Segmented
          label={m.settings.appearance.fontScale}
          options={scaleOptions(m)}
          value={String(a.fontScale)}
          onValueChange={(v) => set({ fontScale: Number(v) as FontScale })}
        />
      </SettingsRow>
      <SettingsRow
        name={m.settings.appearance.zoom}
        description={m.settings.appearance.zoomDesc(
          currentPlatform() === "mac" ? "⌘+ ⌘− ⌘0" : "Ctrl+ Ctrl− Ctrl+0",
        )}
      >
        <Segmented
          label={m.settings.appearance.zoom}
          options={ZOOM_STEPS.map((z) => ({ value: String(z), label: `${Math.round(z * 100)}%` }))}
          value={String(a.zoom)}
          onValueChange={(v) => set({ zoom: Number(v) })}
        />
      </SettingsRow>
      <SettingsRow
        name={m.settings.appearance.defaultWidth}
        description={m.settings.appearance.defaultWidthDesc}
      >
        <Segmented
          label={m.settings.appearance.defaultWidth}
          options={[
            { value: "default", label: m.settings.appearance.widthDefault },
            { value: "wide", label: m.settings.appearance.widthWide },
          ]}
          value={a.defaultWide ? "wide" : "default"}
          onValueChange={(v) => set({ defaultWide: v === "wide" })}
        />
      </SettingsRow>
      <SettingsRow
        name={m.settings.appearance.sky}
        description={m.settings.appearance.skyDesc}
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

/** 화면 언어 (SYS-14) — 시스템 / 한국어 / English */
function LanguageRow() {
  const m = useMessages().settings.general;
  const language = useSession((s) => s.appearance.language);
  return (
    <SettingsRow name={m.language} description={m.languageDescription}>
      <Segmented
        label={m.language}
        options={[
          { value: "system", label: m.languageSystem },
          { value: "ko", label: LOCALE_NAMES.ko },
          { value: "en", label: LOCALE_NAMES.en },
        ]}
        value={language}
        onValueChange={(v) =>
          sessionStore.getState().setAppearance({ language: v as LanguagePref })
        }
      />
    </SettingsRow>
  );
}
