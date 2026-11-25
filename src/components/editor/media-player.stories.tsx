import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { Row, Sheet } from "@/debug/specimen";
import sampleClip from "@/debug/samples/sample-clip.webm?url";
import sampleTone from "@/debug/samples/sample-tone.wav?url";
import { MediaPlayer } from "./media-player";

/**
 * 영상·소리 블록 — 네이티브 미디어 요소 + 토큰 스타일 컨트롤.
 * 키: Space·K 재생/정지 · ← → 5초 · M 음소거 · F 전체 화면(영상). 플레이어 자체(group)에 포커스가 간다.
 */
const meta = {
  title: "L4 에디터/ED-MediaPlayer",
  component: MediaPlayer,
  args: {
    kind: "video",
    name: "시연 영상.webm",
    src: sampleClip,
    mime: "video/webm",
    caption: "앱 시연 — 페이지 만들기",
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
} satisfies Meta<typeof MediaPlayer>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Video: Story = {};

/** 재생 전 첫 프레임: 메타데이터만 받으면(readyState 1) 회색으로 남는다. 현재 프레임까지 디코딩돼야(2 이상) 통과 */
export const FirstFrame: Story = {
  play: async ({ canvasElement }) => {
    const video = canvasElement.querySelector("video")!;
    await waitFor(
      () => expect(video.readyState).toBeGreaterThanOrEqual(HTMLMediaElement.HAVE_CURRENT_DATA),
      { timeout: 15000 },
    );
    // 조각이 붙어 있어야 한다 (Chromium은 조각 없이도 첫 프레임을 그려서, 이 줄이 회귀를 막는다)
    await expect(video.getAttribute("src")).toContain("#t=0.001");
    await expect(video.paused).toBe(true);
  },
};

export const Audio: Story = {
  args: {
    kind: "audio",
    name: "강의 녹음.wav",
    src: sampleTone,
    mime: "audio/wav",
    caption: "3초짜리 테스트 음",
  },
};

/** 키보드: 플레이어에 포커스 → M으로 음소거(버튼 이름이 "소리 켜기"로 바뀜), ← 로 뒤로 (구간 끝에서 멈춤) */
export const KeyboardMute: Story = {
  args: { kind: "audio", name: "강의 녹음.wav", src: sampleTone, mime: "audio/wav" },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const group = c.getByRole("group", { name: /재생기/ });
    group.focus();
    await userEvent.keyboard("m");
    await c.findByRole("button", { name: "소리 켜기" });
    await userEvent.keyboard("m");
    await c.findByRole("button", { name: "음소거" });
    const seek = c.getByRole("slider", { name: "재생 위치" });
    await waitFor(() => expect(seek).not.toBeDisabled());
    await userEvent.keyboard("{ArrowRight}");
    await waitFor(() => expect(seek).toHaveAttribute("aria-valuetext", "0:03 / 0:03"));
  },
};

/** 재생 속도 단계 버튼: 1× → 1.25× */
export const Rate: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(await c.findByRole("button", { name: "재생 속도 1×" }));
    await c.findByRole("button", { name: "재생 속도 1.25×" });
  },
};

/** 재생 불가(주소가 없는 파일) → 파일 카드로 대체 */
export const Broken: Story = {
  args: {
    src: "assets/01JD0000000000000000000000/gone.webm",
    resolveSrc: () => "/debug/no-such-clip.webm",
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await c.findByText("재생할 수 없어요 · 형식을 지원하지 않거나 파일이 없어요");
  },
};

/** 원본 없음 */
export const Missing: Story = {
  args: { missing: true },
};

/** 상태 · 종류 시트 */
export const States: Story = {
  render: (args) => (
    <Sheet title="ED-MediaPlayer">
      <Row name="video">
        <div className="w-full max-w-2xl">
          <MediaPlayer {...args} />
        </div>
      </Row>
      <Row name="audio">
        <div className="w-full max-w-2xl">
          <MediaPlayer
            {...args}
            kind="audio"
            name="강의 녹음.wav"
            src={sampleTone}
            mime="audio/wav"
          />
        </div>
      </Row>
      <Row name="missing">
        <div className="w-full max-w-2xl">
          <MediaPlayer {...args} missing />
        </div>
      </Row>
      <Row name="selected">
        <div className="w-full max-w-2xl">
          <MediaPlayer {...args} selected />
        </div>
      </Row>
    </Sheet>
  ),
};
