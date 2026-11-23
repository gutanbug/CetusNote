import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { PdfPreview } from "./pdf-preview";

// 실제 PDF 쪽 대신 글줄이 있는 SVG 종이 — 쪽 배치·글자 크기·확대 상태를 확인한다
const samplePage = (title: string, body: string[]) => {
  const lines = body
    .map(
      (line, i) =>
        `<text x="60" y="${150 + i * 34}" font-size="20" font-family="sans-serif">${line}</text>`,
    )
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1240" height="1754" viewBox="0 0 1240 1754"><rect width="1240" height="1754" fill="white"/><text x="60" y="90" font-size="34" font-weight="700" font-family="sans-serif">${title}</text>${lines}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

const pages = [
  samplePage("회의 메모", [
    "1. 분기 목표를 다시 확인했어요.",
    "2. 미리보기는 쪽 그림으로 보여 줘요.",
    "3. 저장한 PDF의 글자는 그대로예요.",
  ]),
  samplePage("회의 메모 (2쪽)", [
    "확대하면 글자가 흐리지 않아요.",
    "아래로 스크롤해 다음 쪽을 봐요.",
  ]),
];

const meta = {
  title: "L5 페이지/PG-PdfPreview",
  component: PdfPreview,
  args: {
    open: true,
    onOpenChange: fn(),
    onSave: fn(),
    status: "ready",
    pages,
  },
  // 모달은 화면 전체를 덮으므로 Debug 화면에서 따로 띄운다
  parameters: { debug: { isolate: true } },
} satisfies Meta<typeof PdfPreview>;
export default meta;
type Story = StoryObj<typeof meta>;

/** 미리보기 준비됨 — 쪽 그림과 확대·축소, "PDF로 저장" 사용 가능 */
export const Default: Story = {};

/** PDF를 만드는 중 — 쪽이 아직 없으니 안내만, 저장 잠김 */
export const Loading: Story = {
  args: { status: "loading", pages: [] },
};

/** 쪽을 가져오는 중 — 앞쪽은 먼저 보이고 저장은 아직 잠김 */
export const Partial: Story = {
  args: { status: "loading", pages: pages.slice(0, 1) },
};

/** 저장 대화상자가 열린 뒤 저장하는 중 */
export const Saving: Story = {
  args: { status: "saving" },
};

/** 웹 미리보기처럼 PDF를 만들 수 없는 환경 */
export const Unsupported: Story = {
  args: {
    status: "error",
    pages: [],
    message: "PDF는 데스크톱 앱에서만 만들 수 있어요",
  },
};

/** 다크 테마 — 종이 바탕은 흰색으로 남는다 */
export const Dark: Story = {
  globals: { theme: "dark" },
};
