import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";

const meta = {
  title: "L2 오버레이/OV-Dialog",
  component: DialogContent,
  // Debug 화면: 모달은 화면 전체를 덮으므로 버튼으로 따로 띄운다
  parameters: { layout: "fullscreen", debug: { isolate: true } },
} satisfies Meta<typeof DialogContent>;
export default meta;
type Story = StoryObj<typeof meta>;

function Body() {
  return (
    <>
      <DialogHeader>
        <DialogTitle>휴지통을 비울까요?</DialogTitle>
        <DialogDescription>페이지 12개가 영구 삭제돼요. 되돌릴 수 없어요.</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="ghost">취소</Button>
        </DialogClose>
        <Button variant="danger">영구 삭제</Button>
      </DialogFooter>
    </>
  );
}

export const Small: Story = {
  render: () => (
    <Dialog open>
      <DialogContent size="sm">
        <Body />
      </DialogContent>
    </Dialog>
  ),
};

export const Medium: Story = {
  render: () => (
    <Dialog open>
      <DialogContent size="md">
        <Body />
      </DialogContent>
    </Dialog>
  ),
};

export const Large: Story = {
  render: () => (
    <Dialog open>
      <DialogContent size="lg">
        <Body />
      </DialogContent>
    </Dialog>
  ),
};

/** 버튼으로 열고 Esc나 scrim 클릭으로 닫는다. 포커스가 안에 갇힌다. */
export const Interactive: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="danger">휴지통 비우기</Button>
      </DialogTrigger>
      <DialogContent size="sm">
        <Body />
      </DialogContent>
    </Dialog>
  ),
};
