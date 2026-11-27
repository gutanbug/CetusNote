import { insetFocus, rowActive, rowBase } from "@/components/shell/parts";
import { cn } from "@/lib/utils";
import { SETTINGS_TABS, settingsPanelId, settingsTabId, type SettingsTab } from "./options";
import { rovingKey } from "./roving";
import { useMessages } from "@/lib/i18n";

type SettingsNavProps = {
  value: SettingsTab;
  onValueChange: (tab: SettingsTab) => void;
  /** 탭 패널 id를 만들 때 쓰는 앞붙이 — 패널은 `${idPrefix}-panel-${tab}` */
  idPrefix: string;
  className?: string;
};

/**
 * PG-SettingsNav — 설정 모달 왼쪽 탭 5개 (프로토타입 `.settings-nav`, 폭 200).
 * 세로 탭 목록: ↑↓ Home End로 옮기면 바로 그 탭이 열린다.
 */
function SettingsNav({ value, onValueChange, idPrefix, className }: SettingsNavProps) {
  const m = useMessages();
  const ids = SETTINGS_TABS.map((t) => t.id);
  return (
    <div
      data-slot="settings-nav"
      className={cn(
        "grid content-start gap-0.5 border-r border-line bg-subtle px-2 py-4",
        className,
      )}
    >
      <p
        aria-hidden
        className="px-2 pb-1 text-label font-semibold tracking-(--tracking-label) text-tertiary uppercase"
      >
        {m.page.settingsNav.heading}
      </p>
      <div
        role="tablist"
        aria-label={m.page.settingsNav.tablist}
        aria-orientation="vertical"
        data-roving=""
        className="grid gap-0.5"
      >
        {SETTINGS_TABS.map(({ id, name, icon: Icon }) => {
          const active = id === value;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              id={settingsTabId(idPrefix, id)}
              aria-controls={settingsPanelId(idPrefix, id)}
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              data-value={id}
              data-active={active || undefined}
              onClick={() => onValueChange(id)}
              onKeyDown={(e) => {
                const next = rovingKey(e, ids, value, "vertical");
                if (next) onValueChange(next);
              }}
              className={cn(rowBase, rowActive, "min-h-7.5 gap-2 px-2 py-1", insetFocus)}
            >
              <Icon strokeWidth={1.5} aria-hidden className="size-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { SettingsNav, type SettingsNavProps };
