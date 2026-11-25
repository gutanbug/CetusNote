import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { Row, Sheet } from "@/debug/specimen";
import samplePdf from "@/debug/samples/sample-notes.pdf?url";
import { PdfViewer } from "./pdf-viewer";

/**
 * pdf.js 문서 열기는 워커 시작·파일 읽기·쪽 해석을 거치므로 전체 스토리 실행(부하)에서 기본 1초(findBy 기본값)를 넘길 수 있다.
 * 1초에 맞추지 않고 결과(쪽 번호·오류 안내)가 나올 때까지 기다린다. 단독 실행에서는 보통 100ms대에 끝난다.
 */
const PDF_WAIT = { timeout: 15000 };

/**
 * PDF 블록 — 번들한 pdf.js로 쪽을 세로로 그린다. 확대·축소·쪽 번호, 실패하면 파일 카드로 대체.
 * 견본은 3쪽짜리 PDF 한 개(src/debug/samples/sample-notes.pdf).
 */
const meta = {
  title: "L4 에디터/ED-PdfViewer",
  component: PdfViewer,
  args: {
    name: "회의 메모.pdf",
    src: samplePdf,
    size: 1394,
    onOpen: fn(),
    onDownload: fn(),
    onReveal: fn(),
    onReplace: fn(),
    onRemove: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-2xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PdfViewer>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    // PDF 로딩·첫 쪽 렌더는 부하에 따라 느리다 — 고정 대기 대신 결과를 기다린다
    await c.findByText("1 / 3 쪽", undefined, PDF_WAIT);
    await waitFor(() => expect(canvasElement.querySelector("canvas")).not.toBeNull(), PDF_WAIT);
  },
};

/** 확대 → 125%, 축소 → 100%. 쪽 번호 표시는 그대로 */
export const Zoom: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await c.findByText("1 / 3 쪽", undefined, PDF_WAIT);
    await userEvent.click(c.getByRole("button", { name: "확대" }));
    await c.findByText("125%");
    await userEvent.click(c.getByRole("button", { name: "축소" }));
    await c.findByText("100%");
  },
};

/** 키보드: 영역에 포커스 → Ctrl(⌘)+= 로 확대, Ctrl+0 으로 100%로 되돌림 */
export const KeyboardZoom: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await c.findByText("1 / 3 쪽", undefined, PDF_WAIT);
    const region = c.getByRole("group", { name: /미리 보기/ });
    region.focus();
    await userEvent.keyboard("{Control>}={/Control}");
    await c.findByText("125%");
    await userEvent.keyboard("{Control>}0{/Control}");
    await waitFor(() => expect(c.getByText("100%")).toBeInTheDocument());
  },
};

/** 원본이 없음 → 바로 파일 카드 */
export const Missing: Story = {
  args: { missing: true },
};

/** 불러오기 실패 → 파일 카드로 대체되고 안내 한 줄이 붙는다 */
export const LoadError: Story = {
  args: {
    src: "assets/01JD0000000000000000000000/broken.pdf",
    resolveSrc: () => "/debug/no-such-file.pdf",
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await c.findByText("미리 보기를 열 수 없어요", undefined, PDF_WAIT);
  },
};

/** 읽기 전용 본문 — 바꾸기·삭제 없이 열기와 저장만 */
export const ReadOnly: Story = {
  args: { editable: false },
};

/** 선택 상태 · 상태 목록 */
export const States: Story = {
  render: (args) => (
    <Sheet title="ED-PdfViewer">
      <Row name="default">
        <div className="w-full max-w-2xl">
          <PdfViewer {...args} />
        </div>
      </Row>
      <Row name="selected">
        <div className="w-full max-w-2xl">
          <PdfViewer {...args} selected />
        </div>
      </Row>
      <Row name="missing">
        <div className="w-full max-w-2xl">
          <PdfViewer {...args} missing />
        </div>
      </Row>
    </Sheet>
  ),
};
