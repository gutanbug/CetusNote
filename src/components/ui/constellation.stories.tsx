import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { Constellation } from "./constellation";
import { Kbd } from "./kbd";

/** CetusNote 브랜드 모티프 — 고래자리. 라이트는 인쇄한 성도, 다크는 밤하늘 (docs/design/concept.md) */
const meta = {
  title: "L1 UI/UI-Constellation",
  component: Constellation,
  args: { size: "md", tone: "strong", labels: true },
} satisfies Meta<typeof Constellation>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** 크기 × 강도 — 로고(sm) · 빈 상태·홈(md, 별 이름, 미라 반짝임) · 페이지 배경(lg, 옅게, 움직임 없음) */
export const Matrix: Story = {
  render: () => (
    <div className="grid gap-8">
      <section className="flex items-center gap-3">
        <Constellation size="sm" title="Cetus Note 로고" />
        <span className="text-h3 font-semibold">Cetus Note</span>
      </section>
      <section className="grid justify-items-start gap-2">
        <Constellation size="md" labels title="고래자리" />
        <p className="text-caption text-tertiary">
          빈 상태 · 홈 — 미라(ο Ceti)만 따뜻한 색으로 천천히 밝기가 바뀌어요.
        </p>
      </section>
      <section className="flex max-w-(--content-w) items-start gap-6">
        <div className="min-w-0 flex-1">
          <h2 className="text-h2 font-semibold">회의 메모</h2>
          <p className="mt-2 text-body text-secondary">
            본문은 별자리 위에 놓이지 않아요. 별자리는 본문 폭 바깥 여백에만 옅게 둬요.
          </p>
        </div>
        <Constellation size="lg" tone="faint" />
      </section>
    </div>
  ),
};

/** 빈 상태 예 — 새 워크스페이스 */
/** radiant — 스플래시·첫 설정. 방사형 번짐 + 흰 심 + 양 끝이 사라지는 빛줄기 + 배경 잔별 */
export const Radiant: Story = {
  args: { glow: "radiant", size: "md", tone: "strong" },
  play: async ({ canvasElement }) => {
    const svg = canvasElement.querySelector('[data-slot="constellation"]')!;
    await expect(svg.querySelector("radialGradient")).not.toBeNull();
    // 별 14개 + 잔별 6개 — 애니메이션은 별 묶음마다 하나
    await expect(svg.querySelectorAll(".animate-star-breathe")).toHaveLength(14);
  },
};

export const EmptyState: Story = {
  render: () => (
    <div className="grid max-w-100 justify-items-center gap-4 py-10 text-center">
      <Constellation size="md" />
      <div className="grid gap-1">
        <p className="text-h3 font-semibold">첫 별을 찍어 볼까요?</p>
        <p className="text-caption text-secondary">
          흩어진 메모를 이으면 생각의 모양이 보여요. <Kbd keys={["⌘", "N"]} />로 새 페이지를
          만들어요.
        </p>
      </div>
    </div>
  ),
};
