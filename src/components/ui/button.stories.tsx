import type { Meta, StoryObj } from "@storybook/react-vite";
import { FilePlus2, Trash2 } from "lucide-react";
import { Row, Sheet, Stack } from "@/debug/specimen";
import { Button } from "./button";

const meta = {
  title: "L1 UI/UI-Button",
  component: Button,
  args: { children: "새 페이지", variant: "primary", size: "md" },
  argTypes: {
    variant: { control: "inline-radio", options: ["primary", "secondary", "ghost", "danger"] },
    size: { control: "inline-radio", options: ["sm", "md"] },
  },
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

const VARIANTS = [
  ["primary", "새 페이지"],
  ["secondary", "가져오기"],
  ["ghost", "취소"],
  ["danger", "영구 삭제"],
] as const;

/** 변형 × 상태 (D H A X, loading) — 시트 §2 */
export const Matrix: Story = {
  render: () => (
    <Stack>
      {(["md", "sm"] as const).map((size) => (
        <Sheet key={size} title={`size ${size}`}>
          <Row name="default">
            {VARIANTS.map(([v, t]) => (
              <Button key={v} variant={v} size={size}>
                {t}
              </Button>
            ))}
          </Row>
          <Row name="hover" force="hover">
            {VARIANTS.map(([v, t]) => (
              <Button key={v} variant={v} size={size}>
                {t}
              </Button>
            ))}
          </Row>
          <Row name="active" force="active">
            {VARIANTS.map(([v, t]) => (
              <Button key={v} variant={v} size={size}>
                {t}
              </Button>
            ))}
          </Row>
          <Row name="disabled">
            {VARIANTS.map(([v, t]) => (
              <Button key={v} variant={v} size={size} disabled>
                {t}
              </Button>
            ))}
          </Row>
          <Row name="loading">
            <Button size={size} loading>
              저장 중
            </Button>
            <Button size={size} variant="secondary" loading>
              내보내는 중
            </Button>
          </Row>
        </Sheet>
      ))}
      <Sheet title="아이콘 포함">
        <Row name="icon + label">
          <Button>
            <FilePlus2 strokeWidth={1.5} />새 페이지
          </Button>
          <Button variant="danger">
            <Trash2 strokeWidth={1.5} />
            휴지통 비우기
          </Button>
        </Row>
      </Sheet>
    </Stack>
  ),
};
