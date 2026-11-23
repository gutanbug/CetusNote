import type { Meta, StoryObj } from "@storybook/react-vite";
import type * as React from "react";
import { useEffect } from "react";
import { Row, Sheet } from "@/debug/specimen";
import { Button } from "./button";
import { toast, Toaster } from "./toast";

const meta = {
  title: "L2 오버레이/OV-Toast",
  component: Toaster,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Toaster>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * 견본 상자: 토스트는 화면에 고정(fixed)으로 뜨지만, transform을 가진 조상이 있으면 그 상자 안에 갇힌다.
 * Storybook 문서 페이지와 Debug 화면에서 토스트가 화면 전체를 덮지 않게 한다.
 */
function ToastBox({ children }: { children: React.ReactNode }) {
  return <div className="relative h-56 transform-gpu overflow-hidden rounded-lg">{children}</div>;
}

/** 메시지 · 메시지+실행 취소 · 오류 (시트 §6). 화면 아래 가운데에 쌓인다. */
export const Variants: Story = {
  render: function Render() {
    // 이 스토리의 토스트만 이 Toaster에 뜬다(toasterId) — 다른 견본의 Toaster에 번지지 않는다
    useEffect(() => {
      // id를 고정해 두면 StrictMode·라이트/다크 두 열에서 여러 번 불려도 같은 토스트를 고칠 뿐 늘어나지 않는다
      const on = { toasterId: "story-variants", duration: Infinity } as const;
      toast("페이지를 복제했어요", { ...on, id: "variants-copy" });
      toast("페이지를 휴지통으로 옮겼어요", {
        ...on,
        id: "variants-trash",
        action: { label: "실행 취소", onClick: () => {} },
      });
      toast.error("저장하지 못했어요. 디스크 공간을 확인해 주세요.", {
        ...on,
        id: "variants-error",
      });
    }, []);
    return (
      <ToastBox>
        <Toaster id="story-variants" expand />
      </ToastBox>
    );
  },
};

export const Interactive: Story = {
  render: () => (
    <Sheet>
      <Row name="호출">
        <Button
          variant="secondary"
          onClick={() => toast("링크를 복사했어요", { toasterId: "story-interactive" })}
        >
          메시지
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            toast("페이지를 휴지통으로 옮겼어요", {
              toasterId: "story-interactive",
              action: { label: "실행 취소", onClick: () => {} },
            })
          }
        >
          실행 취소 포함
        </Button>
        <Button
          variant="secondary"
          onClick={() => toast.error("내보내지 못했어요", { toasterId: "story-interactive" })}
        >
          오류
        </Button>
      </Row>
      <ToastBox>
        <Toaster id="story-interactive" />
      </ToastBox>
    </Sheet>
  ),
};
