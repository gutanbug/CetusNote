import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Row, Sheet } from "@/debug/specimen";
import { AppLogo, type AppLogoId } from "./app-logo";
import { ChoiceCards, type ChoiceCardOption } from "./choice-card";

const APPS: ChoiceCardOption<AppLogoId>[] = [
  {
    value: "notion",
    icon: <AppLogo app="notion" />,
    title: "Notion",
    description: "Markdown & CSV 내보내기 zip",
  },
  {
    value: "obsidian",
    icon: <AppLogo app="obsidian" />,
    title: "Obsidian",
    description: "보관소(vault) 폴더 또는 zip",
  },
  {
    value: "appflowy",
    icon: <AppLogo app="appflowy" />,
    title: "AppFlowy",
    description: "Markdown 또는 HTML 내보내기 파일",
  },
  {
    value: "affine",
    icon: <AppLogo app="affine" />,
    title: "AFFiNE",
    description: "Markdown 내보내기 파일과 폴더",
  },
];

function Demo({
  options,
  initial,
  columns,
}: {
  options: ChoiceCardOption<AppLogoId>[];
  initial: AppLogoId | null;
  columns?: 2 | 3 | 4;
}) {
  const [v, setV] = useState<AppLogoId | null>(initial);
  return (
    <div className="w-full max-w-xl">
      <ChoiceCards
        label="가져올 앱"
        options={options}
        value={v}
        onValueChange={setV}
        columns={columns}
      />
    </div>
  );
}

const meta = {
  title: "L1 UI/UI-ChoiceCard",
  component: ChoiceCards,
  args: { options: [], value: null, onValueChange: () => {}, label: "" },
} satisfies Meta<typeof ChoiceCards>;
export default meta;
type Story = StoryObj<typeof meta>;

/** 카드 선택 — Tab으로 그룹에 들어가고 화살표 키로 옮기면 선택도 따라간다. Enter·Space로 고른다 */
export const Matrix: Story = {
  render: () => (
    <Sheet>
      <Row name="4개 · 2열">
        <Demo options={APPS} initial="notion" columns={2} />
      </Row>
      <Row name="4개 · 4열">
        <Demo options={APPS} initial="obsidian" columns={4} />
      </Row>
      <Row name="선택 없음">
        <Demo options={APPS} initial={null} columns={2} />
      </Row>
      <Row name="hover" force="hover">
        <Demo options={APPS.slice(0, 2)} initial="notion" columns={2} />
      </Row>
    </Sheet>
  ),
};
