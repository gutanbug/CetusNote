import { SettingsRow } from "@/components/page/settings-row";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { sessionStore, useSession } from "@/features/session";
import { updaterStore, useUpdater } from "@/features/updater";
import { updateView } from "@/features/updater/view";
import { openWhatsNewForCurrent, releaseUrl } from "@/features/release-notes";
import { openLink } from "@/lib/storage/open-link";
import { useMessages } from "@/lib/i18n";

/** 설정 › 일반 › 업데이트 (SYS-07) — 현재 버전, 확인·설치 버튼, 자동 확인 스위치 */
export function UpdateSection() {
  const m = useMessages();
  const state = useUpdater((s) => s);
  const current = useUpdater((s) => s.currentVersion);
  const autoCheck = useSession((s) => s.autoUpdateCheck);
  const view = updateView(state);
  // 현재 버전은 확인 없이 열 때 읽는다(네트워크를 쓰지 않는다)
  useEffect(() => {
    void updaterStore
      .getState()
      .loadVersion()
      .catch(() => undefined);
  }, []);
  // 오류가 설치 단계에서 났으면 다시 시도는 설치, 확인 단계면 확인이다
  // 새 버전이 나왔을 때만 그 버전의 GitHub 릴리스 페이지 링크를 보인다
  const releaseVersion = view.action === "install" ? state.update?.version : undefined;
  const installNext =
    view.action === "install" || (view.action === "retry" && state.errorStep === "install");

  const onAction = () => {
    if (installNext) void updaterStore.getState().install();
    else void updaterStore.getState().check();
  };

  return (
    <>
      <SettingsRow
        name={m.settings.update.name}
        description={
          <span role="status" aria-live="polite" className={view.error ? "text-danger" : undefined}>
            {m.settings.update.version(current ?? "…")}
            {view.message ? ` · ${view.message}` : ""}
          </span>
        }
      >
        {view.action === "none" ? null : (
          <div className="flex items-center gap-2">
            {releaseVersion ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void openLink(releaseUrl(releaseVersion))}
              >
                {m.settings.update.releaseView}
              </Button>
            ) : null}
            <Button
              variant={view.action === "install" ? "primary" : "secondary"}
              size="sm"
              loading={view.busy}
              disabled={view.actionDisabled}
              onClick={onAction}
            >
              {view.actionLabel}
            </Button>
          </div>
        )}
      </SettingsRow>
      <SettingsRow
        name={m.settings.update.releaseNotesName}
        description={m.settings.update.releaseNotesDesc}
      >
        <Button variant="secondary" size="sm" onClick={() => void openWhatsNewForCurrent()}>
          {m.settings.update.releaseNotesButton}
        </Button>
      </SettingsRow>
      {view.progress !== null || state.status === "downloading" ? (
        <div className="pb-3">
          <Progress aria-label={m.settings.update.progress} value={view.progress ?? 0} />
        </div>
      ) : null}
      <SettingsRow
        name={m.settings.update.autoName}
        description={m.settings.update.autoDesc}
        controlId="auto-update"
      >
        <Switch
          id="auto-update"
          aria-describedby="auto-update-desc"
          checked={autoCheck}
          onCheckedChange={(on) => sessionStore.getState().setAutoUpdateCheck(on)}
        />
      </SettingsRow>
    </>
  );
}
