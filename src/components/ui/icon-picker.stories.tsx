import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { IconPicker } from "./icon-picker";
import { SAMPLE_IMAGE_ICON } from "./page-icon-sample";
import { popoverSurface } from "./styles";

const meta = {
  title: "L2 오버레이/OV-IconPicker",
  component: IconPicker,
  args: { onSelect: fn(), onRemove: fn(), onApply: fn(), onUploadFile: fn(), onUploadLink: fn() },
  render: (args) => (
    <div className={popoverSurface + " inline-block p-0"}>
      <IconPicker {...args} />
    </div>
  ),
} satisfies Meta<typeof IconPicker>;
export default meta;
type Story = StoryObj<typeof meta>;

const RECENT = ["📝", "🚀", "lucide:coffee:brown", "lucide:calendar:blue", SAMPLE_IMAGE_ICON];

/** 이모지 탭 — 검색 · 무작위 · 피부색 · 최근 · 카테고리. 아이콘이 있으면 "제거" */
export const Emoji: Story = {
  args: { value: "📝", recent: RECENT },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    // 최근 이모지는 저장된 글자만 있어도 한국어 이름으로 읽힌다
    const recent = within(c.getByRole("group", { name: "최근 쓴 이모지" }));
    await expect(await recent.findByRole("button", { name: "로켓" })).toBeInTheDocument();
  },
};

/** 아이콘 탭 — lucide 모음, 색, 최근. 지금 아이콘이 눌림으로 보인다 */
export const Icons: Story = {
  args: { value: "lucide:calendar:blue", recent: RECENT },
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    await expect(c.getByRole("tab", { name: "아이콘" })).toHaveAttribute("aria-selected", "true");
    await userEvent.click(c.getByRole("radio", { name: "초록" }));
    await expect(args.onApply).toHaveBeenCalledWith("lucide:calendar:green");
  },
};

/** 검색 — 한국어 검색어로 찾고, 고르면 지금 색으로 */
export const Search: Story = {
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole("tab", { name: "아이콘" }));
    await userEvent.type(c.getByRole("searchbox", { name: "아이콘 검색" }), "로켓");
    await userEvent.click(c.getByRole("button", { name: "로켓 출시" }));
    await expect(args.onSelect).toHaveBeenCalledWith("lucide:rocket");
  },
};

/** 결과 없음 */
export const NoResult: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole("tab", { name: "아이콘" }));
    await userEvent.type(c.getByRole("searchbox", { name: "아이콘 검색" }), "없는아이콘");
    await expect(c.getByText("“없는아이콘”에 맞는 아이콘이 없어요.")).toBeInTheDocument();
  },
};

/** 키보드 — 목록에는 한 칸만 Tab으로 들어오고 화살표로 움직인다 */
export const Keyboard: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole("tab", { name: "아이콘" }));
    const first = c.getByRole("button", { name: "문서 페이지" });
    first.focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(c.getByRole("button", { name: "노트 공책" })).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    await expect(c.getByRole("button", { name: "메모 포스트잇" })).toHaveFocus();
  },
};

/** 업로드 탭 — 끌어 놓기·고르기, 링크, 최근 올린 이미지 */
export const Upload: Story = {
  args: { value: SAMPLE_IMAGE_ICON, recent: RECENT },
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    await expect(c.getByRole("tab", { name: "업로드" })).toHaveAttribute("aria-selected", "true");
    await userEvent.type(
      c.getByRole("textbox", { name: "이미지 링크" }),
      "https://example.com/a.png",
    );
    await userEvent.click(c.getByRole("button", { name: "올리기" }));
    await expect(args.onUploadLink).toHaveBeenCalledWith("https://example.com/a.png");
    await userEvent.click(c.getByRole("button", { name: "최근 올린 이미지 1" }));
    await expect(args.onSelect).toHaveBeenCalledWith(SAMPLE_IMAGE_ICON);
  },
};

/** 올리는 중 · 오류 */
export const UploadStates: Story = {
  args: {
    defaultTab: "upload",
    uploading: true,
    uploadError: "PNG·JPEG·GIF·WebP·AVIF 이미지만 넣을 수 있어요.",
  },
};

/** 무작위 — 창을 닫지 않고 저장(onApply)만 한다. 다시 누르면 다른 아이콘 */
export const Shuffle: Story = {
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole("tab", { name: "아이콘" }));
    await userEvent.click(c.getByRole("button", { name: "무작위 아이콘" }));
    await expect(args.onApply).toHaveBeenCalledWith(expect.stringMatching(/^lucide:/));
    await expect(args.onSelect).not.toHaveBeenCalled();
  },
};

/** 키보드 — Home·End는 줄 처음·끝, ⌘End는 목록 끝 */
export const KeyboardHomeEnd: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole("tab", { name: "아이콘" }));
    c.getByRole("button", { name: "노트 공책" }).focus();
    await userEvent.keyboard("{End}");
    await expect(c.getByRole("button", { name: "신문 뉴스" })).toHaveFocus();
    await userEvent.keyboard("{Home}");
    await expect(c.getByRole("button", { name: "문서 페이지" })).toHaveFocus();
    await userEvent.keyboard("{Meta>}{End}{/Meta}");
    await expect(c.getByRole("button", { name: "반짝" })).toHaveFocus();
  },
};

/** 실제 쓰임 — 고르면 바뀌고, 색만 바꾸면 그대로 열려 있다 */
function Live() {
  const [value, setValue] = useState<string | undefined>("lucide:book-open");
  return (
    <div className="grid gap-3">
      <p className="text-caption text-secondary">지금 값: {value ?? "없음"}</p>
      <div className={popoverSurface + " inline-block p-0"}>
        <IconPicker
          value={value}
          onSelect={setValue}
          onApply={setValue}
          onRemove={() => setValue(undefined)}
        />
      </div>
    </div>
  );
}
export const Interactive: Story = { render: () => <Live /> };
