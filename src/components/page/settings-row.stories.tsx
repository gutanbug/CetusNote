import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SettingsRow } from "./settings-row";

/** 설정 행 — 이름 + 설명 + 컨트롤. 행 사이 구분선, 마지막 행은 없음 */
const meta = {
  title: "L5 페이지/PG-SettingsRow",
  component: SettingsRow,
  args: { name: "시작 화면", description: "앱을 열었을 때 처음 보이는 화면" },
  decorators: [(Story) => <div className="max-w-165">{Story()}</div>],
} satisfies Meta<typeof SettingsRow>;
export default meta;
type Story = StoryObj<typeof meta>;

/** 일반 탭 예 — 입력 · 스위치 · 버튼 · 표시만 */
export const General: Story = {
  render: () => (
    <div>
      <SettingsRow name="워크스페이스 이름" description="사이드바 위에 보여요" controlId="ws-name">
        <Input
          id="ws-name"
          aria-describedby="ws-name-desc"
          defaultValue="내 노트"
          className="w-50"
        />
      </SettingsRow>
      <SettingsRow
        name="홈에서 시작"
        description="끄면 마지막으로 연 페이지에서 시작해요"
        controlId="start-home"
      >
        <Switch id="start-home" aria-describedby="start-home-desc" defaultChecked />
      </SettingsRow>
      <SettingsRow name="저장 위치" description="~/Documents/CetusNote">
        <Button variant="secondary" size="sm">
          Finder에서 보기
        </Button>
      </SettingsRow>
    </div>
  ),
};

/** 아래로 쌓기 — 테마·포인트 색처럼 컨트롤이 넓을 때 */
export const Stacked: Story = {
  args: {
    stacked: true,
    name: "테마",
    description: "시스템을 고르면 OS 설정을 따라요",
    children: <div className="h-20 rounded-lg border border-dashed border-line" />,
  },
};
