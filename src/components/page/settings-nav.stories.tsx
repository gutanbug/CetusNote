import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { SETTINGS_TABS, settingsPanelId, settingsTabId, type SettingsTab } from "./options";
import { SettingsNav } from "./settings-nav";

function Nav({ initial = "appearance" }: { initial?: SettingsTab }) {
  const [tab, setTab] = React.useState<SettingsTab>(initial);
  return (
    <div className="flex h-90">
      <SettingsNav value={tab} onValueChange={setTab} idPrefix="story" className="w-50" />
      {SETTINGS_TABS.map((t) => (
        <section
          key={t.id}
          role="tabpanel"
          id={settingsPanelId("story", t.id)}
          aria-labelledby={settingsTabId("story", t.id)}
          hidden={t.id !== tab}
          className="p-6 text-caption text-secondary"
        >
          {t.name} 설정
        </section>
      ))}
    </div>
  );
}

/** 설정 탭 목록 — 일반 · 외관 · 에디터 · 단축키 · 데이터/백업 · Agent/MCP. ↑↓로 옮기면 바로 연다 */
const meta = {
  title: "L5 페이지/PG-SettingsNav",
  component: Nav,
} satisfies Meta<typeof Nav>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Keyboard: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    c.getByRole("tab", { name: "외관" }).focus();
    await userEvent.keyboard("{ArrowDown}");
    await expect(c.getByRole("tab", { name: "에디터" })).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{End}");
    await waitFor(() => expect(c.getByRole("tab", { name: "Agent / MCP" })).toHaveFocus());
  },
};
