import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Row, Sheet } from "@/debug/specimen";
import { SearchInput } from "./search-input";

function Controlled({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <SearchInput
      value={value}
      onValueChange={setValue}
      placeholder="페이지 검색"
      aria-label="페이지 검색"
      className="w-65"
    />
  );
}

const meta = {
  title: "L1 UI/UI-SearchInput",
  component: SearchInput,
  args: {
    value: "",
    onValueChange: () => {},
    placeholder: "페이지 검색",
    "aria-label": "페이지 검색",
  },
  render: () => <Controlled />,
} satisfies Meta<typeof SearchInput>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** default · focus · 값 있음(지우기 버튼, Esc로 지움) — 시트 §3 */
export const Matrix: Story = {
  render: () => (
    <Sheet>
      <Row name="default">
        <Controlled />
      </Row>
      <Row name="값 있음">
        <Controlled initial="회의록" />
      </Row>
    </Sheet>
  ),
};
