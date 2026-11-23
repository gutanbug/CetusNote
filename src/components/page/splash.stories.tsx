import type { Meta, StoryObj } from "@storybook/react-vite";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import * as React from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { Button } from "@/components/ui/button";
import { Splash } from "./splash";
import { WorkspaceSetup } from "./workspace-setup";

/** 첫 실행 스플래시 (DATA-03) — 별이 켜지고 선이 이어진 뒤 이름이 떠오른다. 아무 키나 클릭으로 건너뛴다 */
const meta = {
  title: "L5 페이지/PG-Splash",
  component: Splash,
  args: { onDone: fn() },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Splash>;
export default meta;
type Story = StoryObj<typeof meta>;

/** 다 보여 주면 onDone (약 2초) */
export const Default: Story = {
  render: (args) => (
    <div className="h-120">
      <Splash {...args} />
    </div>
  ),
  play: async ({ args }) => {
    await waitFor(() => expect(args.onDone).toHaveBeenCalledTimes(1), { timeout: 4000 });
  },
};

/** 아무 키나 누르면 바로 건너뛴다 */
export const Skip: Story = {
  render: (args) => (
    <div className="h-120">
      <Splash {...args} />
    </div>
  ),
  play: async ({ args }) => {
    await userEvent.keyboard("{Enter}");
    await expect(args.onDone).toHaveBeenCalledTimes(1);
  },
};

function Flow() {
  const [run, setRun] = React.useState(0);
  const [splash, setSplash] = React.useState(true);
  return (
    <div className="relative h-150">
      <LayoutGroup>
        <AnimatePresence mode="wait">
          {splash ? (
            <motion.div key={`splash-${run}`} className="h-full" exit={{ opacity: 0 }}>
              <Splash onDone={() => setSplash(false)} />
            </motion.div>
          ) : (
            <motion.div key={`setup-${run}`} className="h-full">
              <WorkspaceSetup
                enter
                defaultLabel="~/Documents/CetusNote"
                onUseDefault={() => {}}
                onPick={() => {}}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </LayoutGroup>
      <Button
        variant="secondary"
        size="sm"
        className="absolute top-3 right-3"
        onClick={() => {
          setRun((r) => r + 1);
          setSplash(true);
        }}
      >
        다시 보기
      </Button>
    </div>
  );
}

/** 스플래시 → 폴더 선택: 별자리는 제자리로 옮겨 가고, 제목과 버튼이 차례로 나타난다 */
export const ToSetup: Story = {
  render: () => <Flow />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.keyboard("{Escape}");
    const create = await canvas.findByRole(
      "button",
      { name: "기본 위치에 만들기" },
      { timeout: 3000 },
    );
    await waitFor(() => expect(create).toHaveFocus());
  },
};
