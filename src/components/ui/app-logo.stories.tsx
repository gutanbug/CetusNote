import type { Meta, StoryObj } from "@storybook/react-vite";
import { Row, Sheet } from "@/debug/specimen";
import { AppLogo, type AppLogoId } from "./app-logo";

const meta = {
  title: "L1 UI/UI-AppLogo",
  component: AppLogo,
  args: { app: "notion" },
} satisfies Meta<typeof AppLogo>;
export default meta;
type Story = StoryObj<typeof meta>;

const APPS: AppLogoId[] = ["notion", "obsidian", "appflowy", "affine"];

/** 단색 로고 4종 · 글자색(currentColor)을 따라간다. 라이트·다크 모두 같은 규칙 */
export const Matrix: Story = {
  render: () => (
    <Sheet>
      <Row name="기본 24px">
        {APPS.map((app) => (
          <span key={app} className="text-primary">
            <AppLogo app={app} />
          </span>
        ))}
      </Row>
      <Row name="보조 글자색">
        {APPS.map((app) => (
          <span key={app} className="text-secondary">
            <AppLogo app={app} />
          </span>
        ))}
      </Row>
    </Sheet>
  ),
};
