import { SettingsRow } from "@/components/page/settings-row";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { sessionStore, useSession } from "@/features/session";
import { updaterStore, useUpdater } from "@/features/updater";
import { updateView } from "@/features/updater/view";

/** 설정 › 일반 › 업데이트 (SYS-07) — 현재 버전, 확인·설치 버튼, 자동 확인 스위치 */
export function UpdateSection() {
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
  const installNext =
    view.action === "install" || (view.action === "retry" && state.errorStep === "install");

  const onAction = () => {
    if (installNext) void updaterStore.getState().install();
    else void updaterStore.getState().check();
  };

  return (
    <>
      <SettingsRow
        name="업데이트"
        description={
          <span role="status" aria-live="polite" className={view.error ? "text-danger" : undefined}>
            현재 버전 {current ?? "…"}
            {view.message ? ` · ${view.message}` : ""}
          </span>
        }
      >
        <Button
          variant={view.action === "install" ? "primary" : "secondary"}
          size="sm"
          loading={view.busy}
          disabled={view.actionDisabled}
          onClick={onAction}
        >
          {view.actionLabel}
        </Button>
      </SettingsRow>
      {view.progress !== null || state.status === "downloading" ? (
        <div className="pb-3">
          <Progress aria-label="업데이트 내려받기 진행률" value={view.progress ?? 0} />
        </div>
      ) : null}
      <SettingsRow
        name="자동으로 업데이트 확인"
        description="앱을 켰을 때와 켜 둔 동안 하루에 한 번 새 버전이 있는지 확인해요. 설치는 물어본 뒤에 해요."
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
