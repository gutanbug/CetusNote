import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { VersionHistory, type VersionGroupView, type VersionListStatus } from "./version-history";

const GROUPS: VersionGroupView[] = [
  {
    label: "오늘",
    rows: [
      { id: "20261121T141005123Z", time: "23:10", relative: "방금 전", chars: "1,284자" },
      { id: "20261121T120000000Z", time: "21:00", relative: "2시간 전", chars: "1,102자" },
    ],
  },
  {
    label: "어제",
    rows: [
      { id: "20261120T093000000Z", time: "18:30", relative: "1일 전", chars: "640자" },
      { id: "20261120T080000000Z", time: "17:00", relative: "1일 전", chars: "0자" },
    ],
  },
  {
    label: "11월 18일",
    rows: [{ id: "20261118T150000000Z", time: "15:00", relative: "3일 전", chars: "2,930자" }],
  },
];

/** 미리보기 자리에 넣는 본문 흉내 (실제 앱은 읽기 전용 편집기) */
function SamplePreview({ id }: { id: string }) {
  return (
    <div className="grid gap-3 text-body leading-relaxed text-primary">
      <p>{id} 시점의 본문 첫 문단이에요. 목록에서 고른 버전이 그대로 보여요.</p>
      <p className="text-secondary">두 번째 문단. 글이 바뀐 자리를 눈으로 확인할 수 있어요.</p>
    </div>
  );
}

/** 긴 본문 — 미리보기 안에서만 스크롤돼야 한다 (DATA-09 회귀 확인용) */
function LongSamplePreview({ id }: { id: string }) {
  return (
    <div className="grid gap-3 text-body leading-relaxed text-primary">
      {Array.from({ length: 60 }, (_, i) => (
        <p key={i}>
          {i + 1}번째 문단. {id} 시점의 본문이에요. 글이 길어져도 미리보기만 스크롤되고 아래 버튼은
          그대로 보여요.
        </p>
      ))}
    </div>
  );
}

type HarnessProps = {
  status: VersionListStatus;
  groups: VersionGroupView[];
  initialSelected?: string | null;
  onSelect?: (id: string) => void;
  onRestore?: () => void;
  restoring?: boolean;
  long?: boolean;
};

/** 선택 상태를 가진 대화상자 — 스토리마다 목록·상태만 바꾼다 */
function Harness({
  status,
  groups,
  initialSelected = null,
  onSelect,
  onRestore,
  restoring,
  long = false,
}: HarnessProps) {
  const [open, setOpen] = React.useState(true);
  const [selected, setSelected] = React.useState<string | null>(initialSelected);
  return (
    <VersionHistory
      open={open}
      onOpenChange={setOpen}
      status={status}
      groups={groups}
      selectedId={selected}
      onSelect={(id) => {
        setSelected(id);
        onSelect?.(id);
      }}
      previewTitle="주간 회의록 2026-11-18"
      preview={
        selected ? (
          long ? (
            <LongSamplePreview id={selected} />
          ) : (
            <SamplePreview id={selected} />
          )
        ) : null
      }
      restoring={restoring}
      onRestore={() => onRestore?.()}
    />
  );
}

const meta = {
  title: "L5 페이지/PG-VersionHistory",
  component: Harness,
  args: {
    status: "ready",
    groups: GROUPS,
    initialSelected: "20261121T141005123Z",
    onSelect: fn(),
    onRestore: fn(),
  },
  // Debug 화면: 모달은 화면 전체를 덮으므로 버튼으로 따로 띄운다
  parameters: { debug: { isolate: true } },
} satisfies Meta<typeof Harness>;
export default meta;
type Story = StoryObj<typeof meta>;

/** 버전 목록 — 날짜별 묶음, 고른 버전이 미리보기에 보인다 */
export const Default: Story = {};

/** 아직 버전이 없음 — 안내 문구만 */
/** 긴 본문: 미리보기만 스크롤되고 머리·버튼 줄은 항상 보인다 */
export const LongPreview: Story = {
  args: { long: true },
};

export const Empty: Story = {
  args: { status: "empty", groups: [], initialSelected: null },
};

/** 목록을 읽는 중 */
export const Loading: Story = {
  args: { status: "loading", groups: [], initialSelected: null },
};

/** 목록을 읽지 못함 */
export const LoadError: Story = {
  args: { status: "error", groups: [], initialSelected: null },
};

/** 되돌리는 중 — 버튼이 잠긴다 */
export const Restoring: Story = {
  args: { restoring: true },
};

/** 다크 테마 */
export const Dark: Story = {
  globals: { theme: "dark" },
};

/** 키보드: 첫 행에서 ↓ → 다음 버전이 고름, End → 마지막, Enter → 그 행, Tab → 되돌리기 */
export const Keyboard: Story = {
  play: async ({ args }) => {
    const body = within(document.body);
    const first = await body.findByRole("option", { name: /23:10/ });
    first.focus();
    await userEvent.keyboard("{ArrowDown}");
    await waitFor(() =>
      expect(body.getByRole("option", { name: /21:00/ })).toHaveAttribute("aria-selected", "true"),
    );
    await waitFor(() => expect(body.getByRole("option", { name: /21:00/ })).toHaveFocus());
    await expect(args.onSelect).toHaveBeenLastCalledWith("20261121T120000000Z");

    await userEvent.keyboard("{End}");
    await waitFor(() =>
      expect(body.getByRole("option", { name: /15:00/ })).toHaveAttribute("aria-selected", "true"),
    );
    await userEvent.keyboard("{Home}");
    await waitFor(() =>
      expect(body.getByRole("option", { name: /23:10/ })).toHaveAttribute("aria-selected", "true"),
    );
    await userEvent.keyboard("{Enter}");
    await userEvent.click(body.getByRole("button", { name: "이 버전으로 되돌리기" }));
    await expect(args.onRestore).toHaveBeenCalledTimes(1);
  },
};
