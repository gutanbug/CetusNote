import * as React from "react";
import { SettingsRow } from "@/components/page/settings-row";
import { ShortcutRecorder } from "@/components/page/shortcut-recorder";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { changeAppPrefs, type AppPrefsResult } from "@/features/session/app-prefs";
import { DEFAULT_APP_PREFS, type AppPrefs, type DoubleTapKey } from "@/features/session/store";
import { useSession } from "@/features/session";
import { useMessages } from "@/lib/i18n";
import { currentPlatform } from "@/lib/platform-labels";

/** 설정 일반 탭의 「빠른 입력 · 메뉴 막대」 묶음 (SYS-15, QN-03). 모든 값은 changeAppPrefs로 Rust에 적용한다 */
export function QuickInputSettings() {
  const m = useMessages();
  const g = m.settings.general;
  const menuBarResident = useSession((s) => s.menuBarResident);
  const launchAtLogin = useSession((s) => s.launchAtLogin);
  const quickShortcut = useSession((s) => s.quickShortcut);
  const doubleTap = useSession((s) => s.doubleTap);
  const isMac = currentPlatform() === "mac";

  const notify = React.useCallback(
    (result: AppPrefsResult) => {
      if (result.ok) return;
      toast.error(
        result.code === "shortcut_unavailable"
          ? g.prefShortcutUnavailable
          : result.code === "accessibility_required"
            ? g.prefAccessibilityRequired
            : g.prefFailed,
      );
    },
    [g],
  );

  const apply = React.useCallback(
    (patch: Partial<AppPrefs>) => {
      void changeAppPrefs(patch).then(notify);
    },
    [notify],
  );

  const onShortcut = React.useCallback(
    (quickShortcut: string) => apply({ quickShortcut }),
    [apply],
  );

  const recorderLabels = React.useMemo(
    () => ({
      aria: g.quickShortcutAria,
      recording: g.quickShortcutRecording,
      empty: g.quickShortcutEmpty,
      hint: g.quickShortcutHint,
      issue: {
        no_modifier: g.quickShortcutNoModifier,
        reserved: g.quickShortcutReserved,
      },
    }),
    [g],
  );

  const tapOptions: { value: DoubleTapKey; label: string }[] = [
    { value: "off", label: g.doubleTapOff },
    { value: "control", label: g.doubleTapControl },
    { value: "shift", label: g.doubleTapShift },
    { value: "command", label: g.doubleTapCommand },
  ];

  return (
    <section aria-labelledby="quick-input-settings-title" className="mt-6">
      <h3 id="quick-input-settings-title" className="text-ui font-medium">
        {g.quickInputSection}
      </h3>
      <SettingsRow
        name={g.menuBarResident}
        description={g.menuBarResidentDesc}
        controlId="menu-bar-resident"
      >
        <Switch
          id="menu-bar-resident"
          aria-describedby="menu-bar-resident-desc"
          checked={menuBarResident}
          onCheckedChange={(on) => apply({ menuBarResident: on })}
        />
      </SettingsRow>
      <SettingsRow
        name={g.launchAtLogin}
        description={g.launchAtLoginDesc}
        controlId="launch-at-login"
      >
        <Switch
          id="launch-at-login"
          aria-describedby="launch-at-login-desc"
          checked={launchAtLogin}
          onCheckedChange={(on) => apply({ launchAtLogin: on })}
        />
      </SettingsRow>
      <SettingsRow name={g.quickShortcut} description={g.quickShortcutDesc}>
        <ShortcutRecorder
          value={quickShortcut}
          defaultValue={DEFAULT_APP_PREFS.quickShortcut}
          onChange={onShortcut}
          labels={recorderLabels}
        />
      </SettingsRow>
      {isMac ? (
        <SettingsRow name={g.doubleTap} description={g.doubleTapDesc}>
          <Segmented
            label={g.doubleTap}
            options={tapOptions}
            value={doubleTap}
            onValueChange={(v) => apply({ doubleTap: v as DoubleTapKey })}
          />
        </SettingsRow>
      ) : null}
    </section>
  );
}
