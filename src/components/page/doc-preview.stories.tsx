import type { Meta, StoryObj } from "@storybook/react-vite";
import { DocPreview } from "./doc-preview";
import { SAMPLE_DOCS } from "./template-samples";

/** 문서 미리보기 — 앞부분 블록을 한 줄씩 작게 (템플릿 카드 안, PAGE-14) */
const meta = {
  title: "L5 페이지/PG-DocPreview",
  component: DocPreview,
  args: { doc: SAMPLE_DOCS.meeting, className: "h-28 rounded-lg bg-subtle p-2.5" },
  decorators: [(Story) => <div className="w-64">{Story()}</div>],
} satisfies Meta<typeof DocPreview>;
export default meta;
type Story = StoryObj<typeof meta>;

/** 제목 · 글머리 · 번호 · 체크리스트 */
export const Meeting: Story = {};

/** 끝낸 할 일 · 인용 */
export const Daily: Story = { args: { doc: SAMPLE_DOCS.daily } };

/** 코드 블록 */
export const Study: Story = { args: { doc: SAMPLE_DOCS.study } };

/** 빈 문서 */
export const Empty: Story = { args: { doc: SAMPLE_DOCS.empty } };

/** 줄 수 상한 — 넘치면 자른다 */
export const Max3: Story = { args: { doc: SAMPLE_DOCS.meeting, max: 3 } };
