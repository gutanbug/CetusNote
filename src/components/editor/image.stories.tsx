import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fireEvent, fn, userEvent, waitFor, within } from "storybook/test";
import { EditorSpecimen } from "@/debug/editor-specimen";
import { getEditor } from "@/debug/editor-test";
import cover from "@/debug/samples/cover-meeting.jpg";
import thumb from "@/debug/samples/thumb-study.jpg";
import { Toaster } from "@/components/ui/toast";
import type { Editor } from "@tiptap/core";
import type { ImageSource } from "./image";

/** 저장 경로 → 견본 이미지 (실제 앱은 워크스페이스 assets를 blob URL로) */
const SAMPLES: Record<string, string> = {
  "assets/01JD0000000000000000000000/cover.jpg": cover,
  "assets/01JD0000000000000000000000/study.jpg": thumb,
};
const images = (over: Partial<ImageSource> = {}): ImageSource => ({
  load: async (src) => SAMPLES[src] ?? Promise.reject(new Error("없음")),
  upload: fn(async () => "assets/01JD0000000000000000000000/study.jpg"),
  pick: fn(async () => "assets/01JD0000000000000000000000/study.jpg"),
  ...over,
});
const figure = (src: string, caption = "", width = 100) =>
  `<figure data-type="image" data-src="${src}" data-width="${width}"><figcaption>${caption}</figcaption></figure>`;
const COVER = "assets/01JD0000000000000000000000/cover.jpg";
const STUDY = "assets/01JD0000000000000000000000/study.jpg";

/**
 * 이미지 블록 + 캡션 — `/이미지`, 이미지 파일 붙여넣기·끌어 놓기.
 * 이미지를 누르면 고르고, 오른쪽 손잡이로 너비를 바꾼다(키보드: ←→ 5%, Home·End).
 */
const meta = {
  title: "L4 에디터/ED-Image",
  component: EditorSpecimen,
  args: { images: images() },
} satisfies Meta<typeof EditorSpecimen>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    content: `<p>11월 3주차 회의 화이트보드.</p>${figure(COVER, "회의실 화이트보드 — 다음 주 안건까지")}<p>사진 아래에 이어서 적는다.</p>`,
  },
};

/** 너비를 줄인 이미지 — 가운데 정렬 */
export const Narrow: Story = {
  args: { content: figure(STUDY, "공부 노트 표지", 50) },
};

/** 캡션 없음 — 이미지를 고르거나 캡션에 캐럿이 있을 때만 "캡션 추가"가 보인다 */
export const NoCaption: Story = {
  args: { content: `${figure(STUDY, "", 60)}<p>캡션 없는 이미지.</p>` },
};

/** 불러오는 중 */
export const Loading: Story = {
  args: {
    images: images({ load: () => new Promise(() => {}) }),
    content: figure(COVER, "불러오는 중인 이미지"),
  },
};

/** 파일이 없어졌거나 읽지 못함 */
export const Broken: Story = {
  args: { content: figure("assets/01JD0000000000000000000000/gone.png", "지워진 이미지") },
};

/** 읽기 전용 — 너비 손잡이 없음 */
export const ReadOnly: Story = {
  args: { editable: false, content: figure(COVER, "회의실 화이트보드") },
};

/** 키보드: 너비 손잡이 ←→ · End, 캡션 맨 앞 Backspace로 이미지 고르기, `/이미지` */
export const Keyboard: Story = {
  args: { content: `${figure(STUDY, "공부", 50)}<p></p>` },
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    const slider = await c.findByRole("slider", { name: "이미지 너비" });
    // user-event는 contenteditable 안 요소에 포커스를 줄 때 선택을 흉내 내지 못해 키를 직접 보낸다
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    await waitFor(() => expect(slider).toHaveAttribute("aria-valuenow", "60"));
    fireEvent.keyDown(slider, { key: "End" });
    await waitFor(() => expect(slider).toHaveAttribute("aria-valuenow", "100"));
    fireEvent.keyDown(slider, { key: "Home" });
    await waitFor(() => expect(slider).toHaveAttribute("aria-valuenow", "10"));
    await waitFor(() => expect(c.getByRole("img", { name: "공부" })).toBeVisible());

    // 캡션 맨 앞에서 Backspace → 이미지를 고른다
    const editor = getEditor(canvasElement);
    editor.chain().focus().setTextSelection(1).run();
    await waitFor(() => expect(editor.isFocused).toBe(true)); // focus는 다음 프레임에
    await userEvent.keyboard("{Backspace}");
    await waitFor(() => expect(editor.state.selection.toJSON()).toMatchObject({ type: "node" }));
    // 캡션에서 Enter → 이미지 아래 새 문단
    editor.chain().focus().setTextSelection(3).run();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(editor.state.selection.$from.parent.type.name).toBe("paragraph"));

    await userEvent.keyboard("/이미지");
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(args.images!.pick).toHaveBeenCalled());
    await waitFor(() => expect(c.getAllByRole("slider", { name: "이미지 너비" })).toHaveLength(2));
  },
};

/** 캡션 Enter로 생긴 줄바꿈: 그 아래 문단 맨 앞 Backspace는 이미지를 고르지 않고 캡션에 합친다 (EDIT-14) */
export const CaptionLineBreakBackspace: Story = {
  args: { content: `${figure(STUDY, "공부")}<p></p>` },
  play: async ({ canvasElement }) => {
    const editor = getEditor(canvasElement);
    editor.chain().focus().setTextSelection(3).run();
    await waitFor(() => expect(editor.isFocused).toBe(true));
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(editor.state.selection.$from.parent.type.name).toBe("paragraph"));
    await userEvent.keyboard("다");
    await userEvent.keyboard("{ArrowLeft}");
    await userEvent.keyboard("{Backspace}");
    await waitFor(() => expect(editor.state.selection.$from.parent.type.name).toBe("image"));
    await waitFor(() =>
      expect(imageNodes(editor)).toEqual([{ src: STUDY, remote: null, caption: "공부다" }]),
    );
    expect(editor.state.selection.empty).toBe(true);
    // 원래 있던 빈 문단만 남는다 (Enter로 만든 줄의 글은 캡션으로 합쳐졌다)
    expect(editor.state.doc.childCount).toBe(2);
    expect(editor.state.doc.child(1).textContent).toBe("");
  },
};

/** 실제 붙여넣기 이벤트 (웹 페이지처럼 HTML과 글자를 함께) */
function paste(editor: Editor, html: string, text = "") {
  const data = new DataTransfer();
  data.setData("text/plain", text);
  if (html) data.setData("text/html", html);
  editor.view.dom.dispatchEvent(
    new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }),
  );
}
async function emptyDoc(editor: Editor) {
  editor.commands.setContent("<p></p>");
  editor.chain().focus("start").run();
  await waitFor(() => expect(editor.view.hasFocus()).toBe(true));
}
const imageNodes = (e: Editor) => {
  const out: { src: unknown; remote: unknown; caption: string }[] = [];
  e.state.doc.descendants((n) => {
    if (n.type.name === "image")
      out.push({ src: n.attrs.src, remote: n.attrs.remote, caption: n.textContent });
  });
  return out;
};
const withToaster = [
  (Story: React.ComponentType) => (
    <>
      <Story />
      <Toaster />
    </>
  ),
];

const WEB_HTML = [
  "<p>웹에서 복사한 글</p>",
  '<figure><picture><source srcset="x.webp"><img src="https://example.com/chart.png" alt="대체"></picture><figcaption>분기 차트</figcaption></figure>',
  '<p><img src="https://example.com/whiteboard.jpg" alt="회의실 화이트보드"></p>',
  '<p><a href="https://example.com/post"><img src="https://example.com/fail.jpg" alt="깨진 사진"></a></p>',
  '<img src="https://tracker.example.com/pixel.gif" width="1" height="1">',
  '<img src="data:image/png;base64,iVBORw0KGgo=">',
  '<img src="file:///Users/me/secret.png">',
  "<p>끝</p>",
].join("");

/**
 * 웹 글 붙여넣기(EDIT-24) — 이미지를 내려받아 이 페이지에 저장한다. 링크로 감싼 이미지도.
 * 실패하면 원래 주소의 링크로 남기고 한 번 알린다. 추적용 1px 이미지와 http·https·data 밖의 주소는 버린다.
 * 실행 취소 한 번이면 붙여넣기 전으로.
 */
export const PasteWebImages: Story = {
  decorators: withToaster,
  args: {
    images: images({
      fetch: fn(async (url: string) => {
        if (url.includes("fail")) throw new Error("404");
        return STUDY;
      }),
      upload: fn(async () => COVER),
    }),
  },
  play: async ({ canvasElement, args }) => {
    const editor = getEditor(canvasElement);
    await emptyDoc(editor);
    paste(editor, WEB_HTML, "웹에서 복사한 글");
    await waitFor(() =>
      expect(imageNodes(editor), "내려받은 이미지 2개").toEqual([
        { src: STUDY, remote: null, caption: "분기 차트" },
        { src: STUDY, remote: null, caption: "회의실 화이트보드" },
        { src: COVER, remote: null, caption: "" },
      ]),
    );
    // 이미지를 감싼 문단·링크는 벗겨서 앞뒤에 빈 문단이 남지 않는다
    const blocks: string[] = [];
    editor.state.doc.forEach((n) => blocks.push(n.type.name + (n.content.size ? "" : "(빈)")));
    await expect(blocks, "블록").toEqual([
      "paragraph",
      "image",
      "image",
      "paragraph",
      "image(빈)", // 캡션 없는 이미지
      "paragraph",
    ]);
    const fetched = vi(args.images!.fetch!);
    await expect(fetched, "웹 주소 3개만 내려받는다").toEqual([
      "https://example.com/chart.png",
      "https://example.com/whiteboard.jpg",
      "https://example.com/fail.jpg",
    ]);
    await expect(args.images!.upload, "data: 이미지는 파일로 저장").toHaveBeenCalledTimes(1);
    // 실패한 이미지는 캡션 글의 링크로
    let href: unknown = null;
    editor.state.doc.descendants((n) => {
      if (n.isText && n.text === "깨진 사진") href = n.marks[0]?.attrs.href;
    });
    await expect(href, "실패 → 원래 주소 링크").toBe("https://example.com/fail.jpg");
    await expect(
      await within(document.body).findByText("웹 이미지를 가져오지 못했어요"),
    ).toBeInTheDocument();
    // 실행 취소 한 번이면 붙여넣기 전으로(내려받기 결과는 기록에 넣지 않는다)
    editor.commands.undo();
    await expect(editor.state.doc.textContent).toBe("");
  },
};

/** 내려받는 중 — 이미지 자리에 "가져오는 중" */
export const PasteWebImagesFetching: Story = {
  args: { images: images({ fetch: () => new Promise(() => {}) }) },
  play: async ({ canvasElement }) => {
    const editor = getEditor(canvasElement);
    await emptyDoc(editor);
    paste(editor, '<p><img src="https://example.com/slow.jpg" alt="느린 사진"></p>');
    await expect(
      await within(canvasElement).findByRole("img", { name: "이미지를 가져오는 중" }),
    ).toBeInTheDocument();
    await expect(imageNodes(editor)[0]?.remote).toBe("https://example.com/slow.jpg");
  },
};

/** 마크다운 `![설명](주소)`도 내려받는다. 내려받기가 없으면(읽기 전용 견본 등) 링크로 */
export const PasteMarkdownImage: Story = {
  decorators: withToaster,
  args: { images: images({ fetch: fn(async () => STUDY) }) },
  play: async ({ canvasElement }) => {
    const editor = getEditor(canvasElement);
    await emptyDoc(editor);
    paste(editor, "", "# 표지\n\n![공부 노트 표지](https://example.com/study.jpg)");
    await waitFor(() =>
      expect(imageNodes(editor)).toEqual([{ src: STUDY, remote: null, caption: "공부 노트 표지" }]),
    );
  },
};

export const PasteWebImagesWithoutFetch: Story = {
  decorators: withToaster,
  args: { images: images() },
  play: async ({ canvasElement }) => {
    const editor = getEditor(canvasElement);
    await emptyDoc(editor);
    paste(editor, '<p><img src="https://example.com/a.jpg" alt="사진"></p>');
    await waitFor(() => expect(editor.state.doc.textContent).toBe("사진"));
    await expect(imageNodes(editor)).toEqual([]);
  },
};

/** fn() 목이 받은 첫 인자들 */
function vi(mock: unknown): unknown[] {
  return (mock as { mock: { calls: unknown[][] } }).mock.calls.map((c) => c[0]);
}

/** 붙여 넣은 HTML에 앱 형식의 figure[data-remote]가 들어 있어도 http·https·data 밖의 주소는 받지 않는다 */
export const PastedRemoteFigureIsChecked: Story = {
  args: { images: images({ fetch: fn(async () => STUDY) }) },
  play: async ({ canvasElement, args }) => {
    const editor = getEditor(canvasElement);
    await emptyDoc(editor);
    paste(
      editor,
      '<figure data-type="image" data-remote="file:///etc/passwd"><figcaption>가짜</figcaption></figure><p>끝</p>',
    );
    await waitFor(() => expect(editor.state.doc.textContent).toContain("끝"));
    await expect(imageNodes(editor)[0]?.remote, "주소를 버린다").toBeNull();
    await expect(args.images!.fetch).not.toHaveBeenCalled();
  },
};
