import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent } from "storybook/test";
import { Row, Sheet } from "@/debug/specimen";
import { useState } from "react";
import { Calendar, type CalendarProps } from "./calendar";

// 고정된 「오늘」 — 2026-11-24(화). 스토리가 날짜에 흔들리지 않게 today를 준다.
const TODAY = new Date(2026, 10, 24, 9, 0);

const meta = {
  title: "L1 UI/UI-Calendar",
  component: Calendar,
  args: { today: TODAY, value: "2026-11-28", onChange: fn() },
  decorators: [
    (Story) => (
      <div className="inline-block rounded-lg bg-elevated p-3 shadow-popover">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Calendar>;
export default meta;
type Story = StoryObj<typeof meta>;

/** 선택 날짜를 들고 있는 견본. 고르면 값이 바뀐다 */
function Controlled(props: CalendarProps) {
  const [value, setValue] = useState<string | null>(props.value ?? null);
  return (
    <Calendar
      {...props}
      value={value}
      onChange={(d) => {
        setValue(d);
        props.onChange?.(d);
      }}
    />
  );
}

export const Playground: Story = {
  render: (args) => <Controlled {...args} />,
};

/** 오늘 테두리 · 선택 · 다른 달 날짜(흐림) · 주 시작 요일 · 범위 제한 */
export const Matrix: Story = {
  render: (args) => (
    <Sheet>
      <Row name="기본 (일요일 시작)">
        <Calendar {...args} value="2026-11-28" />
      </Row>
      <Row name="월요일 시작 · 오늘 선택">
        <Calendar {...args} weekStartsOn={1} value="2026-11-24" />
      </Row>
      <Row name="범위 11/20–12/5">
        <Calendar {...args} min="2026-11-20" max="2026-12-05" value="2026-11-28" />
      </Row>
      <Row name="선택 없음" force="hover">
        <Calendar {...args} value={null} defaultMonth="2027-01-01" />
      </Row>
    </Sheet>
  ),
};

/** 키보드: 방향키 한 칸·한 주, Home/End 주의 처음·끝, PageDown 달, Enter 고르기 */
export const KeyboardPlay: Story = {
  args: { value: "2026-11-28" },
  render: (args) => <Controlled {...args} />,
  play: async ({ canvasElement, args }) => {
    const cell = (iso: string) =>
      canvasElement.querySelector<HTMLButtonElement>(`[data-iso="${iso}"]`);
    const active = () => (document.activeElement as HTMLElement | null)?.dataset.iso;

    cell("2026-11-28")!.focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(active()).toBe("2026-11-29");
    await userEvent.keyboard("{ArrowDown}");
    await expect(active()).toBe("2026-12-06");
    await userEvent.keyboard("{ArrowUp}");
    await expect(active()).toBe("2026-11-29");
    await userEvent.keyboard("{PageDown}");
    await expect(active()).toBe("2026-12-29");
    await userEvent.keyboard("{Home}");
    await expect(active()).toBe("2026-12-27");
    await userEvent.keyboard("{End}");
    await expect(active()).toBe("2027-01-02");
    await userEvent.keyboard("{Shift>}{PageUp}{/Shift}");
    await expect(active()).toBe("2026-01-02");
    await userEvent.keyboard("{Enter}");
    await expect(args.onChange).toHaveBeenLastCalledWith("2026-01-02");
  },
};

/** 범위 밖 날짜는 고를 수 없고, 화살표로도 그 날짜에 머물 수 없다 */
export const RangeLimit: Story = {
  args: { value: "2026-11-30", min: "2026-11-20", max: "2026-12-05" },
  render: (args) => <Controlled {...args} />,
  play: async ({ canvasElement, args }) => {
    const cell = (iso: string) =>
      canvasElement.querySelector<HTMLButtonElement>(`[data-iso="${iso}"]`);
    await expect(cell("2026-11-19")?.getAttribute("aria-disabled")).toBe("true");
    cell("2026-11-19")!.click();
    await expect(args.onChange).not.toHaveBeenCalled();
    cell("2026-12-05")!.focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect((document.activeElement as HTMLElement).dataset.iso).toBe("2026-12-05");
  },
};
