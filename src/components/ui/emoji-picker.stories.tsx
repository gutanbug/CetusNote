import type { Meta, StoryObj } from "@storybook/react-vite";
import { Smile } from "lucide-react";
import { useState } from "react";
import { Button } from "./button";
import { EmojiPicker, type PickedEmoji } from "./emoji-picker";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { popoverSurface } from "./styles";

const meta = {
  title: "L2 오버레이/OV-EmojiPicker",
  component: EmojiPicker,
  args: { onSelect: () => {} },
} satisfies Meta<typeof EmojiPicker>;
export default meta;
type Story = StoryObj<typeof meta>;

/** 팝오버 표면 위의 기본 상태 — 검색 · 카테고리 */
export const Default: Story = {
  render: (args) => (
    <div className={popoverSurface + " inline-block p-0"}>
      <EmojiPicker {...args} />
    </div>
  ),
};

/** 최근 쓴 이모지 줄 + 제거 버튼(페이지 아이콘) */
export const WithRecent: Story = {
  args: {
    recent: [
      { emoji: "📝", label: "메모" },
      { emoji: "💡", label: "전구" },
      { emoji: "✅", label: "체크 표시 버튼" },
      { emoji: "📌", label: "압정" },
      { emoji: "🗂️", label: "카드 색인 분류기" },
      { emoji: "🚀", label: "로켓" },
      { emoji: "☕", label: "따뜻한 음료" },
      { emoji: "🎯", label: "명중" },
      { emoji: "🌱", label: "새싹" },
    ],
    onRemove: () => {},
  },
  render: Default.render,
};

/** 실제 쓰임: 버튼을 누르면 팝오버로 뜨고, 고르면 닫힌다 */
function PopoverDemo() {
  const [emoji, setEmoji] = useState("📝");
  const [recent, setRecent] = useState<PickedEmoji[]>([
    { emoji: "💡", label: "전구" },
    { emoji: "✅", label: "체크 표시 버튼" },
  ]);
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary">
          {emoji ? <span className="text-body leading-none">{emoji}</span> : <Smile />}
          아이콘 바꾸기
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto max-w-none p-0" align="start">
        <EmojiPicker
          recent={recent}
          onRemove={() => {
            setEmoji("");
            setOpen(false);
          }}
          onSelect={(e) => {
            setEmoji(e.emoji);
            setRecent((r) => [e, ...r.filter((x) => x.emoji !== e.emoji)].slice(0, 16));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

export const InPopover: Story = { render: () => <PopoverDemo /> };
