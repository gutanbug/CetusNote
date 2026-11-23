import type { Meta, StoryObj } from "@storybook/react-vite";
import { Ellipsis, PanelLeft, Plus, Star } from "lucide-react";
import { Row, Sheet, Stack } from "@/debug/specimen";
import { IconButton } from "./icon-button";
import { Kbd } from "./kbd";

const meta = {
  title: "L1 UI/UI-IconButton",
  component: IconButton,
  args: { label: "새 페이지", children: <Plus strokeWidth={1.5} /> },
} satisfies Meta<typeof IconButton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

const icons = (size: "sm" | "md") => (
  <>
    <IconButton size={size} label="새 페이지">
      <Plus strokeWidth={1.5} />
    </IconButton>
    <IconButton size={size} label="사이드바 접기" shortcut={<Kbd keys={["⌘", "\\"]} />}>
      <PanelLeft strokeWidth={1.5} />
    </IconButton>
    <IconButton size={size} label="더 보기">
      <Ellipsis strokeWidth={1.5} />
    </IconButton>
  </>
);

/** sm(26) · md(32) × 상태 — 시트 §2 */
export const Matrix: Story = {
  render: () => (
    <Stack>
      {(["sm", "md"] as const).map((size) => (
        <Sheet key={size} title={`size ${size}`}>
          <Row name="default">{icons(size)}</Row>
          <Row name="hover" force="hover">
            {icons(size)}
          </Row>
          <Row name="active" force="active">
            {icons(size)}
          </Row>
          <Row name="on">
            <IconButton size={size} label="즐겨찾기 해제" on aria-pressed>
              <Star strokeWidth={1.5} />
            </IconButton>
          </Row>
          <Row name="disabled">
            <IconButton size={size} label="새 페이지" disabled>
              <Plus strokeWidth={1.5} />
            </IconButton>
          </Row>
        </Sheet>
      ))}
    </Stack>
  ),
};
