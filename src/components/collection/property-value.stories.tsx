import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { PropertyValueCell } from "./property";
import type { CustomProperty, PropertyValue } from "./property-types";
import { SAMPLE_PROPERTIES } from "./sample";

const byId = (id: string) => SAMPLE_PROPERTIES.find((p) => p.id === id)!;

function Live({ field, initial }: { field: CustomProperty; initial: PropertyValue }) {
  const [value, setValue] = React.useState(initial);
  const [options, setOptions] = React.useState(field.options);
  return (
    <PropertyValueCell
      field={{ ...field, options }}
      value={value}
      onChange={setValue}
      onCreateOption={(name) => {
        setOptions((o) => [...o, { name, color: "pink" }]);
        setValue(field.type === "multi" ? [...(Array.isArray(value) ? value : []), name] : name);
      }}
    />
  );
}

const ROWS: { field: CustomProperty; value: PropertyValue; text?: string }[] = [
  { field: byId("fbudget01"), value: 1250000 },
  { field: byId("fstage001"), value: "검토 중" },
  { field: byId("fteam0001"), value: ["디자인", "개발"] },
  { field: byId("fcheck001"), value: true },
  { field: byId("flink0001"), value: "cetus.example/notes/sprint" },
  { field: byId("fmemo0001"), value: "리뷰 전에 데모 시나리오 한 번 더" },
  {
    field: { id: "fphone001", name: "연락처", type: "phone", options: [] },
    value: "010-1234-5678",
  },
  { field: { id: "fmail0001", name: "이메일", type: "email", options: [] }, value: null },
  {
    field: { id: "fdate0001", name: "회고일", type: "date", options: [] },
    value: "2026-11-28",
    text: "11월 28일",
  },
  {
    field: { id: "fmade0001", name: "만든 날짜", type: "created", options: [] },
    value: "2026-11-20T09:00:00.000Z",
    text: "2026년 11월 20일 18:00",
  },
];

/** 사용자 속성 값 칸 (COLL-08) — 종류마다 편집기가 다르다. 표 칸과 상세 행이 함께 쓴다 */
const meta = {
  title: "L6 컬렉션/CL-PropertyValue",
  component: PropertyValueCell,
  args: { field: byId("fstage001"), value: "검토 중", onChange: fn() },
  render: () => (
    <div role="table" aria-label="속성 값" className="grid w-120 gap-1 bg-app p-6">
      {ROWS.map((r) => (
        <div role="row" key={r.field.id} className="flex items-center gap-2">
          <span role="rowheader" className="w-24 shrink-0 text-ui text-secondary">
            {r.field.name}
          </span>
          <span role="cell" className="flex min-w-0 flex-1">
            {r.text !== undefined ? (
              <PropertyValueCell field={r.field} value={r.value} text={r.text} onChange={fn()} />
            ) : (
              <Live field={r.field} initial={r.value} />
            )}
          </span>
        </div>
      ))}
    </div>
  ),
} satisfies Meta<typeof PropertyValueCell>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** 값 칸 hover 강제 */
export const Hover: Story = {
  decorators: [(Story) => <div data-force="hover">{Story()}</div>],
};

/** 키보드: 숫자 적고 Enter, 선택에 없는 옵션을 적어 만들기, 체크박스 Space */
export const Keyboard: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(c.getByRole("button", { name: /^예산:/ }));
    const num = await body.findByRole("textbox", { name: "예산" });
    await userEvent.clear(num);
    await userEvent.type(num, "3,000{Enter}");
    await expect(c.getByRole("button", { name: /^예산:/ })).toHaveTextContent("3,000");

    await userEvent.click(c.getByRole("button", { name: /^단계:/ }));
    await userEvent.type(
      await body.findByRole("textbox", { name: "단계 옵션 찾기" }),
      "보류{Enter}",
    );
    await expect(c.getByRole("button", { name: /^단계:/ })).toHaveTextContent("보류");

    const box = c.getByRole("checkbox", { name: "검수 완료" });
    box.focus();
    await userEvent.keyboard(" ");
    await expect(box).toHaveAttribute("aria-checked", "false");
  },
};
