import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fireEvent, fn, userEvent, waitFor, within } from "storybook/test";
import { Row, Sheet, Stack } from "@/debug/specimen";
import { FileAttachment } from "./file-attachment";

/** 카드 폭 — 본문 블록처럼 넓은 칸에 놓는다 */
const Frame = ({ children }: { children: React.ReactNode }) => (
  <div className="w-full max-w-md">{children}</div>
);

const actions = () => ({
  onOpen: fn(),
  onReveal: fn(),
  onDownload: fn(),
  onReplace: fn(),
  onRemove: fn(),
});

/**
 * 파일 첨부 카드 — 확장자별 아이콘 · 이름(가운데 줄임) · 크기 · 형식.
 * Tab으로 카드에 들어가 Enter를 누르면 열고, ⋯ 메뉴나 메뉴 키(Shift+F10)로 나머지 동작을 쓴다.
 */
const meta = {
  title: "L4 에디터/ED-FileAttachment",
  component: FileAttachment,
  args: {
    name: "2026-11 회의록.pdf",
    size: 2_411_724,
    mime: "application/pdf",
    ...actions(),
  },
  decorators: [
    (Story) => (
      <Frame>
        <Story />
      </Frame>
    ),
  ],
} satisfies Meta<typeof FileAttachment>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** 카드 상태 × 시트 — 호버·선택·올리는 중·원본 없음·크기 초과 */
export const Matrix: Story = {
  render: () => {
    const file = (over: Partial<React.ComponentProps<typeof FileAttachment>> = {}) => (
      <Frame>
        <FileAttachment
          name="2026-11 회의록.pdf"
          size={2_411_724}
          mime="application/pdf"
          {...actions()}
          {...over}
        />
      </Frame>
    );
    return (
      <Sheet title="ED-FileAttachment">
        <Row name="default">{file()}</Row>
        <Row name="hover" force="hover">
          {file()}
        </Row>
        <Row name="selected">{file({ selected: true })}</Row>
        <Row name="uploading">
          {file({ name: "설계 메모.docx", size: 880_000, mime: undefined, progress: 42 })}
        </Row>
        <Row name="missing">{file({ missing: true })}</Row>
        <Row name="oversize">
          {file({ name: "원본 영상 촬영본.zip", size: 31 * 1024 * 1024, mime: undefined })}
        </Row>
        <Row name="read-only">{file({ editable: false })}</Row>
        <Row name="notice">{file({ notice: "미리 보기를 열 수 없어요" })}</Row>
      </Sheet>
    );
  },
};

/** 긴 이름은 가운데를 줄이고 확장자를 남긴다 (전체 이름은 툴팁 title) */
export const LongName: Story = {
  args: {
    name: "회의록_최종_검토의견_반영본_2026년_11월_3주차_외부공유용_v3_수정.pdf",
    size: 512_000,
  },
};

/** 확장자별 아이콘 — 문서·표·발표·압축·코드·사진 */
export const Icons: Story = {
  render: () => (
    <Stack>
      {["보고서.docx", "예산.xlsx", "발표.pptx", "자료.zip", "index.tsx", "사진.heic", "메모"].map(
        (name) => (
          <Frame key={name}>
            <FileAttachment name={name} size={96_000} />
          </Frame>
        ),
      )}
    </Stack>
  ),
};

/** Enter로 열기: 카드 본문에 Tab으로 들어가 Enter */
export const KeyboardOpen: Story = {
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    const open = await c.findByRole("button", { name: /회의록/ });
    open.focus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(args.onOpen).toHaveBeenCalledTimes(1));
  },
};

/** 원본 없음·크기 초과는 열기가 막힌다 (Enter 무시) — 바꾸기·삭제는 메뉴에서 쓴다 */
export const DisabledOpenIgnoresEnter: Story = {
  args: { missing: true },
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    const open = await c.findByRole("button", { name: /회의록/ });
    open.focus();
    await userEvent.keyboard("{Enter}");
    expect(args.onOpen).not.toHaveBeenCalled();
    expect(open).toHaveAttribute("aria-disabled", "true");
  },
};

/** ⋯ 메뉴: 버튼에 포커스 → Enter로 열기 → ↓로 이동 → Escape로 닫으면 버튼으로 돌아간다 */
export const MenuKeyboard: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const trigger = await c.findByRole("button", { name: "파일 메뉴" });
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    const menu = await within(document.body).findByRole("menu");
    await waitFor(() => expect(within(menu).getByRole("menuitem", { name: "열기" })).toHaveFocus());
    await userEvent.keyboard("{ArrowDown}");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};

/** 메뉴 키(또는 Shift+F10)로 여는 컨텍스트 메뉴 — 같은 항목을 보여 준다 */
export const ContextMenu: Story = {
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    const open = await c.findByRole("button", { name: /회의록/ });
    fireEvent.contextMenu(open);
    const item = await within(document.body).findByRole("menuitem", { name: "삭제" });
    await userEvent.click(item);
    await waitFor(() => expect(args.onRemove).toHaveBeenCalledTimes(1));
  },
};
