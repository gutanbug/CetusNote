import type { Meta, StoryObj } from "@storybook/react-vite";
import { LayoutGrid, List, Moon, Sun, SunMoon } from "lucide-react";
import { useState } from "react";
import { Row, Sheet } from "@/debug/specimen";
import { Segmented, type SegmentedOption } from "./segmented";

function Demo<T extends string>({
  options,
  initial,
  label,
}: {
  options: SegmentedOption<T>[];
  initial: T;
  label: string;
}) {
  const [v, setV] = useState<T>(initial);
  return <Segmented options={options} value={v} onValueChange={setV} label={label} />;
}

const meta = {
  title: "L1 UI/UI-Segmented",
  component: Segmented,
  args: { options: [], value: "", onValueChange: () => {}, label: "" },
} satisfies Meta<typeof Segmented>;
export default meta;
type Story = StoryObj<typeof meta>;

const ic = { strokeWidth: 1.5 } as const;

/** 2–4개 · 선택 — 화살표 키로 이동 */
export const Matrix: Story = {
  render: () => (
    <Sheet>
      <Row name="2개">
        <Demo
          label="보기 방식"
          initial="list"
          options={[
            { value: "list", label: "목록", icon: <List {...ic} /> },
            { value: "grid", label: "갤러리", icon: <LayoutGrid {...ic} /> },
          ]}
        />
      </Row>
      <Row name="3개">
        <Demo
          label="테마"
          initial="system"
          options={[
            { value: "light", label: "라이트", icon: <Sun {...ic} /> },
            { value: "dark", label: "다크", icon: <Moon {...ic} /> },
            { value: "system", label: "시스템", icon: <SunMoon {...ic} /> },
          ]}
        />
      </Row>
      <Row name="4개">
        <Demo
          label="글꼴"
          initial="sans"
          options={[
            { value: "sans", label: "기본" },
            { value: "serif", label: "명조" },
            { value: "mono", label: "고정폭" },
            { value: "large", label: "크게" },
          ]}
        />
      </Row>
      <Row name="hover" force="hover">
        <Demo
          label="보기 방식"
          initial="list"
          options={[
            { value: "list", label: "목록" },
            { value: "grid", label: "갤러리" },
          ]}
        />
      </Row>
    </Sheet>
  ),
};
