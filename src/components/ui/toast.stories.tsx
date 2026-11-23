import type { Meta, StoryObj } from "@storybook/react-vite";
import type * as React from "react";
import { useEffect } from "react";
import { Row, Sheet } from "@/debug/specimen";
import { Button } from "./button";
import { Progress } from "./progress";
import { toast, Toaster, ToastCancelButton } from "./toast";

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

/**
 * 유지형 토스트 (SYS-07): 자동으로 사라지지 않고, 밀어서 닫지 않는다. 「닫기」나 주 버튼으로만 넘어간다.
 * 새 버전 알림(주 버튼: 업데이트)과 내려받기 오류(주 버튼: 다시 시도).
 */
export const Persistent: Story = {
  render: function Render() {
    useEffect(() => {
      // 두 토스트는 각자 상자(Toaster)에 두어 서로 가리지 않게 한다
      const on = { duration: Infinity, dismissible: false } as const;
      toast("새 버전 0.2.0이 나왔어요", {
        ...on,
        toasterId: "story-persistent-update",
        id: "persistent-update",
        action: { label: "업데이트", onClick: (e) => e.preventDefault() },
        cancel: (
          <ToastCancelButton onClick={() => toast.dismiss("persistent-update")}>
            닫기
          </ToastCancelButton>
        ),
      });
      toast.error("업데이트를 내려받지 못했어요. 다시 시도해 주세요.", {
        ...on,
        toasterId: "story-persistent-error",
        id: "persistent-error",
        action: { label: "다시 시도", onClick: (e) => e.preventDefault() },
        cancel: (
          <ToastCancelButton onClick={() => toast.dismiss("persistent-error")}>
            닫기
          </ToastCancelButton>
        ),
      });
    }, []);
    return (
      <>
        <ToastBox>
          <Toaster id="story-persistent-update" containerAriaLabel="업데이트 알림" />
        </ToastBox>
        <ToastBox>
          <Toaster id="story-persistent-error" containerAriaLabel="오류 알림" />
        </ToastBox>
      </>
    );
  },
};

/**
 * 내려받는 중 (SYS-07): 「닫기」로 토스트를 치울 수 있다. 내려받기는 계속되고 설정 화면에 진행률이 남는다.
 */
export const Downloading: Story = {
  render: function Render() {
    useEffect(() => {
      // 실제 업데이트 토스트와 같은 본문: 글 + 가는 진행률 막대(UI-Progress)
      toast(
        <span className="grid w-40 gap-1.5">
          <span>내려받는 중 40%</span>
          <Progress value={40} aria-label="내려받기 진행률" />
        </span>,
        {
          toasterId: "story-downloading",
          id: "story-downloading-toast",
          duration: Infinity,
          dismissible: false,
          cancel: (
            <ToastCancelButton onClick={() => toast.dismiss("story-downloading-toast")}>
              닫기
            </ToastCancelButton>
          ),
        },
      );
    }, []);
    return (
      <ToastBox>
        <Toaster id="story-downloading" containerAriaLabel="업데이트 알림" />
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
