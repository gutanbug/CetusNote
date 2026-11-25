import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { EditorSpecimen } from "@/debug/editor-specimen";

const CONTENT =
  '<div data-type="callout" data-emoji="💡" data-color="blue"><p>단축키 <code>⌘K</code>로 어디서든 페이지를 찾을 수 있다.</p></div><div data-type="callout" data-emoji="⚠️" data-color="yellow"><p>휴지통은 30일 뒤 자동으로 비워진다.</p></div><div data-type="callout" data-emoji="✅" data-color="green"><p>모든 노트는 이 컴퓨터에만 저장된다.</p></div><div data-type="callout" data-emoji="❗" data-color="red"><p>내보내기 전에 백업 폴더를 확인하자.</p></div>';

/** 콜아웃 — `:::` + 스페이스. 아이콘을 눌러 이모지와 색을 바꾼다 */
const meta = {
  title: "L4 에디터/ED-Callout",
  component: EditorSpecimen,
} satisfies Meta<typeof EditorSpecimen>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { content: CONTENT },
};

/** 읽기 전용 (휴지통 미리보기 등) */
export const ReadOnly: Story = {
  args: { content: CONTENT, editable: false },
};

const LONG_PARAGRAPH =
  "이 노트는 이 컴퓨터의 워크스페이스 폴더에만 저장되며, 동기화 서버나 계정 없이도 모든 기능을 쓸 수 있다. 백업은 폴더를 복사하면 된다.";

/** 첫 블록이 무엇이든 이모지 가운데가 첫 줄 가운데와 맞는다 (차이 2px 이내) */
const ALIGN_CASES: { label: string; first: string }[] = [
  { label: "문단", first: "<p>단축키로 어디서든 페이지를 찾는다.</p>" },
  { label: "제목 1", first: "<h1>회의 결정 사항</h1>" },
  { label: "제목 2", first: "<h2>배포 체크리스트</h2>" },
  { label: "제목 3", first: "<h3>세부 작업</h3>" },
  {
    label: "글머리 목록",
    first: "<ul><li><p>검색 색인 점검</p></li><li><p>휴지통 확인</p></li></ul>",
  },
  {
    label: "체크리스트",
    first:
      '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>디자인 검토</p></li></ul>',
  },
  { label: "두 줄 문단", first: `<p>${LONG_PARAGRAPH}</p>` },
];

/** 첫 줄 맞춤 — 콜아웃 첫 블록 종류별 이모지 가운데와 첫 줄 가운데 */
export const Alignment: Story = {
  args: {
    content: ALIGN_CASES.map(
      ({ first }) =>
        `<div data-type="callout" data-emoji="💡" data-color="blue">${first}<p>콜아웃 본문 문단.</p></div>`,
    ).join(""),
  },
  play: async ({ canvasElement }) => {
    const callouts = [...canvasElement.querySelectorAll<HTMLElement>(".sn-callout")];
    await expect(callouts).toHaveLength(ALIGN_CASES.length);
    const offsets = callouts.map((callout, i) => {
      const label = ALIGN_CASES[i].label;
      const emoji = callout.querySelector<HTMLElement>(".sn-callout-emoji");
      const first = callout.querySelector<HTMLElement>(".sn-callout-body > div > :first-child");
      if (!emoji || !first) return { label, diff: Infinity };
      // 첫 블록의 첫 글자 조각 (여러 줄이면 첫 줄). 체크박스 옆 숨은 글자(label 안)는 건너뛴다
      const walker = document.createTreeWalker(first, NodeFilter.SHOW_TEXT);
      let text: Text | null = null;
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (n.textContent?.trim() && !n.parentElement?.closest("label")) {
          text = n as Text;
          break;
        }
      }
      if (!text) return { label, diff: Infinity };
      const range = document.createRange();
      range.selectNodeContents(text);
      const line = range.getClientRects()[0];
      const lineCenter = line.top + line.height / 2;
      const box = emoji.getBoundingClientRect();
      const emojiCenter = box.top + box.height / 2;
      return { label, diff: Math.round((emojiCenter - lineCenter) * 10) / 10 };
    });
    // 「두 줄 문단」은 실제로 두 줄 이상으로 줄바꿈돼야 한다 (첫 줄 맞춤의 전제)
    const wrapped = callouts[ALIGN_CASES.findIndex((c) => c.label === "두 줄 문단")];
    const wrapText = wrapped.querySelector(".sn-callout-body > div > :first-child")!;
    const wrapRange = document.createRange();
    wrapRange.selectNodeContents(wrapText);
    const lineTops = new Set([...wrapRange.getClientRects()].map((r) => Math.round(r.top)));
    await expect(lineTops.size, "두 줄 문단 줄 수").toBeGreaterThanOrEqual(2);
    // 모든 경우의 차이를 한 번에 보고한다 (|이모지 가운데 − 첫 줄 가운데| ≤ 2px)
    const failing = offsets.filter((o) => Math.abs(o.diff) > 2);
    await expect(failing, JSON.stringify(offsets)).toEqual([]);
  },
};
