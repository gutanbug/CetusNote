import type { Meta, StoryObj } from "@storybook/react-vite";
import { Smile } from "lucide-react";
import { useId, useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { Row, Sheet } from "@/debug/specimen";
import { Button } from "@/components/ui/button";
import {
  matchShortcodes,
  nextActiveIndex,
  SHORTCODES,
  type ShortcodeItem,
} from "@/lib/emoji/shortcodes";
import { EditorSpecimen } from "@/debug/editor-specimen";
import { getEditor } from "@/debug/editor-test";
import { empty } from "./attachment-fixtures";
import { EmojiInlinePopover, EmojiShortcodeMenu } from "./emoji-inline";

const meta = {
  title: "L4 에디터/ED-EmojiInline",
  component: EmojiShortcodeMenu,
  args: { id: "shortcode-story", items: matchShortcodes("s"), activeIndex: 0, onSelect: fn() },
} satisfies Meta<typeof EmojiShortcodeMenu>;
export default meta;
type Story = StoryObj<typeof meta>;

/** 단축 코드 제안 목록 — 활성 항목 · hover · 결과 없음(목록이 사라진다) */
export const ShortcodeList: Story = {
  render: (args) => (
    <Sheet>
      <Row name="활성 항목 1번">
        <EmojiShortcodeMenu {...args} />
      </Row>
      <Row name="활성 3번">
        <EmojiShortcodeMenu {...args} id="shortcode-3" activeIndex={2} />
      </Row>
      <Row name="hover" force="hover">
        <EmojiShortcodeMenu
          {...args}
          id="shortcode-hover"
          activeIndex={-1}
          items={matchShortcodes("th")}
        />
      </Row>
      <Row name="결과 없음">
        <EmojiShortcodeMenu {...args} id="shortcode-none" items={matchShortcodes("zzz")} />
        <span className="text-caption text-tertiary">목록이 나오지 않는다</span>
      </Row>
    </Sheet>
  ),
};

/** 본문 견본: 콜론을 쓰면 목록이 뜨고, 방향키로 고르고 Enter로 글자를 넣는다. Esc는 목록을 닫는다 */
function ShortcodeTyping() {
  const id = useId();
  const [text, setText] = useState("오늘 기분 ");
  const [active, setActive] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const match = /:([a-z0-9_]*)$/i.exec(text);
  const items: ShortcodeItem[] = match && !dismissed ? matchShortcodes(match[0]) : [];
  const open = items.length > 0;

  const choose = (item: ShortcodeItem) => {
    setText((t) => t.replace(/:[a-z0-9_]*$/i, item.emoji + " "));
    setActive(0);
    setDismissed(false);
  };

  return (
    <div className="relative grid w-80 gap-2">
      <label className="grid gap-1 text-label font-medium text-secondary">
        본문 견본 (`:` 입력)
        <input
          aria-label="본문 견본"
          role="combobox"
          aria-expanded={open}
          aria-controls={id}
          aria-activedescendant={open ? `${id}-${active}` : undefined}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setActive(0);
            setDismissed(false);
          }}
          onKeyDown={(e) => {
            if (!open) return;
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              setActive(nextActiveIndex(active, e.key, items.length));
            } else if (e.key === "Enter") {
              e.preventDefault();
              choose(items[active]);
            } else if (e.key === "Escape") {
              e.preventDefault();
              setDismissed(true);
            }
          }}
          className="min-h-9 rounded-md border border-line-control bg-app px-3 text-body text-primary focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-solid"
        />
      </label>
      <EmojiShortcodeMenu
        id={id}
        items={items}
        activeIndex={active}
        onActiveChange={setActive}
        onSelect={choose}
      />
    </div>
  );
}

export const TypedShortcode: Story = {
  render: () => <ShortcodeTyping />,
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole("combobox");
    input.focus();
    await userEvent.type(input, ":s");
    await waitFor(() => expect(within(document.body).getByRole("listbox")).toBeTruthy());
    await userEvent.keyboard("{ArrowDown}");
    await userEvent.keyboard("{Enter}");
    // 「s」 앞부분 목록의 둘째는 sunglasses(😎)
    await waitFor(() => expect((input as HTMLInputElement).value).toBe("오늘 기분 😎 "));
  },
};

/** 본문 옆 버튼으로 여는 이모지 피커 — 고르면 팝오버가 닫히고 글자를 넣는다 */
function PickerDemo({ onSelect }: { onSelect: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("회의록 ");
  return (
    <div className="grid w-80 gap-3">
      <div className="min-h-9 text-body text-primary">
        {text}
        <span className="sr-only">(본문)</span>
      </div>
      <EmojiInlinePopover
        open={open}
        onOpenChange={setOpen}
        recent={[
          { emoji: "📝", label: "메모" },
          { emoji: "💡", label: "전구" },
        ]}
        onSelect={({ emoji }) => {
          setText((t) => t + emoji);
          onSelect(emoji);
        }}
      >
        <Button variant="secondary" size="sm">
          <Smile strokeWidth={1.5} />
          이모지 넣기
        </Button>
      </EmojiInlinePopover>
    </div>
  );
}

export const PickerPopover: Story = {
  render: () => <PickerDemo onSelect={fn()} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /이모지 넣기/ }));
    const recent = await within(document.body).findByRole("button", { name: "메모" });
    await userEvent.click(recent);
    await waitFor(() => expect(canvas.getByText(/회의록 📝/)).toBeTruthy());
    await waitFor(() =>
      expect(within(document.body).queryByRole("button", { name: "메모" })).toBeNull(),
    );
  },
};

/* ───── 본문에서 (EDIT-35) ───── */

/** `:sm` → 단축 코드 목록 → Enter로 이모지 글자 (EDIT-19 입력 규칙과 같이 본다) */
export const ShortcodeInEditor: Story = {
  render: () => <EditorSpecimen content={empty} />,
  play: async ({ canvasElement }) => {
    const editor = getEditor(canvasElement);
    editor.chain().focus("end").insertContent(":sm").run();
    const list = await within(document.body).findByRole("listbox", { name: "이모지 제안" });
    await expect(within(list).getAllByRole("option").length).toBeGreaterThan(0);
    await userEvent.keyboard("{Enter}");
    const smile = SHORTCODES.find((item) => item.code === "smile")!.emoji;
    await waitFor(() => expect(editor.getText()).toContain(smile));
    await expect(within(document.body).queryByRole("listbox", { name: "이모지 제안" })).toBeNull();
  },
};

/** `/이모지` → 피커가 캐럿 자리에 열리고, Escape로 닫으면 포커스는 편집기로 돌아온다 */
export const SlashEmojiInEditor: Story = {
  render: () => <EditorSpecimen content={empty} />,
  play: async ({ canvasElement }) => {
    const editor = getEditor(canvasElement);
    editor.chain().focus("end").insertContent("/이모지").run();
    await within(document.body).findByRole("listbox", { name: "블록 넣기" });
    await userEvent.keyboard("{Enter}");
    const dialog = await within(document.body).findByRole("dialog", { name: "이모지 넣기" });
    // 열리는 동안 애니메이션이 돌아 visible 검사 대신 열린 상태를 본다
    await expect(dialog).toHaveAttribute("data-state", "open");
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(within(document.body).queryByRole("dialog", { name: "이모지 넣기" })).toBeNull(),
    );
    await waitFor(() => expect(editor.isFocused).toBe(true));
  },
};
