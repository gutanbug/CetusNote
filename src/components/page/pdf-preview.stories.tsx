import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { PdfPreview } from "./pdf-preview";

const meta = {
  title: "L5 페이지/PG-PdfPreview",
  component: PdfPreview,
  args: {
    open: true,
    onOpenChange: fn(),
    onSave: fn(),
    status: "ready",
    // 실제 PDF 대신 빈 문서 — 미리보기 자리와 버튼 배치만 확인한다
    previewUrl: "about:blank",
  },
  // 모달은 화면 전체를 덮으므로 Debug 화면에서 따로 띄운다
  parameters: { debug: { isolate: true } },
} satisfies Meta<typeof PdfPreview>;
export default meta;
type Story = StoryObj<typeof meta>;

/** 미리보기 준비됨 — "PDF로 저장" 사용 가능 */
export const Default: Story = {};

/** PDF를 만드는 중 — 자리에 안내만, 저장 잠김 */
export const Loading: Story = {
  args: { status: "loading", previewUrl: null },
};

/** 저장 대화상자가 열린 뒤 저장하는 중 */
export const Saving: Story = {
  args: { status: "saving" },
};

/** 웹 미리보기처럼 PDF를 만들 수 없는 환경 */
export const Unsupported: Story = {
  args: {
    status: "error",
    previewUrl: null,
    message: "PDF는 데스크톱 앱에서만 만들 수 있어요",
  },
};

/** 다크 테마 */
export const Dark: Story = {
  globals: { theme: "dark" },
};
