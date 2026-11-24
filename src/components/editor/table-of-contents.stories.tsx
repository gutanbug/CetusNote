import type { Meta, StoryObj } from "@storybook/react-vite";
import { EditorSpecimen } from "@/debug/editor-specimen";

const TOC = '<div data-type="table-of-contents"></div>';

/** 중첩된 제목 (H1 아래 H2, H2 아래 H3, 다시 H2·H1) */
const NESTED = [
  TOC,
  "<h1>시작하기</h1>",
  "<p>이 노트는 이 컴퓨터의 폴더에만 저장돼요. 백업은 설정에서 만들 수 있어요.</p>",
  "<h2>설치</h2>",
  "<p>워크스페이스 폴더를 고르면 바로 쓸 수 있어요.</p>",
  "<h3>요구 사항</h3>",
  "<p>macOS, Windows, Linux에서 실행돼요.</p>",
  "<h2>사용법</h2>",
  "<p>⌘K로 어디서든 페이지를 찾아요.</p>",
  "<h1>단축키</h1>",
  "<p>단축키 목록은 설정 › 단축키에서 볼 수 있어요.</p>",
].join("");

/** 제목이 없을 때 — 안내 문구만 보인다 */
const EMPTY = [TOC, "<p>아직 제목이 없어요.</p>"].join("");

/** 제목이 아주 많은 긴 문서 (목록이 길어져도 한 줄씩 잘린다) */
const LONG = [
  TOC,
  ...Array.from(
    { length: 30 },
    (_, i) => `<h2>${i + 1}주차 회의 메모 — 진행 상황과 다음 할 일</h2><p>내용</p>`,
  ),
].join("");

/** 목차 블록 — `/목차`로 넣는다. 제목 H1–H3를 계층으로 보여 주고 누르면 그 제목으로 간다 */
const meta = {
  title: "L4 에디터/ED-TableOfContents",
  component: EditorSpecimen,
} satisfies Meta<typeof EditorSpecimen>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { content: NESTED },
};

/** 제목이 없는 문서 */
export const Empty: Story = {
  args: { content: EMPTY },
};

/** 제목이 많은 문서 */
export const LongList: Story = {
  args: { content: LONG },
};

/** 접힌 토글 안의 제목 — 목차에서 누르면 토글이 펼쳐지고 그 제목으로 간다 (EDIT-27) */
const COLLAPSED = [
  TOC,
  "<h1>본문</h1>",
  ...Array.from({ length: 40 }, () => "<p>긴 본문 문단입니다. 목차 이동을 확인하려고 여러 줄을 채웁니다.</p>"),
  "<details><summary>접힌 토글</summary><div><h2>토글 안의 제목</h2><p>토글 안 내용</p></div></details>",
].join("");

export const CollapsedToggle: Story = {
  args: { content: COLLAPSED },
};

/** 다크 — 항목 글자와 왼쪽 선이 다크 배경에서 같은 위계로 읽히는지 */
export const Dark: Story = {
  args: { content: NESTED },
  globals: { theme: "dark" },
};
