import type { Meta, StoryObj } from "@storybook/react-vite";
import { Row, Sheet } from "@/debug/specimen";
import { SOFT_COLORS, TagChip } from "./tag-chip";

const NAMES = ["보관", "독서", "업무", "아이디어", "여행", "회의", "개인", "건강", "긴급"];

const meta = {
  title: "L1 UI/UI-TagChip",
  component: TagChip,
  args: { children: "아이디어", color: "yellow" },
  argTypes: { color: { control: "select", options: SOFT_COLORS } },
} satisfies Meta<typeof TagChip>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** 소프트 컬러 9종 · 삭제 버튼 유무 × hover — 시트 §4 */
export const Matrix: Story = {
  render: () => (
    <Sheet>
      <Row name="9종">
        {SOFT_COLORS.map((c, i) => (
          <TagChip key={c} color={c}>
            {NAMES[i]}
          </TagChip>
        ))}
      </Row>
      <Row name="삭제 버튼">
        {SOFT_COLORS.map((c, i) => (
          <TagChip key={c} color={c} onRemove={() => {}}>
            {NAMES[i]}
          </TagChip>
        ))}
      </Row>
      <Row name="hover" force="hover">
        <TagChip color="blue" onRemove={() => {}}>
          회의
        </TagChip>
      </Row>
      <Row name="긴 이름">
        <TagChip color="purple">2026년 하반기 제품 로드맵 회의 메모</TagChip>
      </Row>
    </Sheet>
  ),
};
