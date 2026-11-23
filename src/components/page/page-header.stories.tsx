import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";
import { expect, userEvent, within } from "storybook/test";
import { Properties } from "./properties";
import { SAMPLE_IMAGE_ICON } from "@/components/ui/page-icon-sample";
import { PageHeader, type PageHeaderProps } from "./page-header";

function Header(props: Partial<PageHeaderProps>) {
  const [title, setTitle] = React.useState(props.title ?? "11월 18일 주간 회의");
  const [icon, setIcon] = React.useState(props.icon);
  return (
    <PageHeader
      {...props}
      title={title}
      onTitleChange={setTitle}
      icon={icon}
      onIconChange={setIcon}
      onAddCover={() => {}}
      onOpenTemplates={() => {}}
    >
      {props.children}
    </PageHeader>
  );
}

/**
 * 페이지 헤더 — 커버(P1) · 아이콘(이모지·lucide·이미지, PAGE-10) · 제목(40px) · hover/포커스에 “커버 추가 · 아이콘 추가 · 템플릿”.
 * 아래에 PG-Properties와 구분선이 온다.
 */
const meta = {
  title: "L5 페이지/PG-PageHeader",
  component: Header,
  args: { icon: "📝" },
} satisfies Meta<typeof Header>;
export default meta;
type Story = StoryObj<typeof meta>;

/** 아이콘 + 제목 + 속성 */
export const Default: Story = {
  args: {
    children: (
      <Properties
        tags={[{ id: "t1", name: "회의", color: "blue" }]}
        status="진행 중"
        created="2026년 11월 18일"
      />
    ),
  },
};

/** 아이콘 없음 — “아이콘 추가” 버튼 (hover 상태로 확인) */
export const NoIcon: Story = { args: { icon: undefined } };

/** 빈 제목 — 자리 표시 “제목 없음” */
export const EmptyTitle: Story = { args: { title: "", icon: undefined } };

/** 키보드 — 제목 편집, 버튼 줄이 포커스에 드러난다 */
export const Keyboard: Story = {
  args: { title: "", icon: undefined },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const title = c.getByRole("textbox", { name: "페이지 제목" });
    await userEvent.click(title);
    // user-event는 plaintext-only 편집 칸에 글자를 넣지 못해 브라우저 입력 명령으로 넣는다
    document.execCommand("insertText", false, "제주 여행");
    await expect(title).toHaveTextContent("제주 여행");
    await userEvent.tab();
    await expect(c.getByRole("button", { name: "커버 추가" })).toHaveFocus();
  },
};

/** lucide 아이콘 (색 파랑) */
export const LucideIcon: Story = { args: { icon: "lucide:book-open:blue" } };

/** 올린 이미지 아이콘 */
export const ImageIcon: Story = { args: { icon: SAMPLE_IMAGE_ICON } };

/** 아이콘 고르기 — 아이콘 탭에서 하나를 고르면 바뀌고 닫힌다 */
export const PickIcon: Story = {
  args: {
    recentIcons: ["🚀", "lucide:rocket:orange", SAMPLE_IMAGE_ICON],
    iconUpload: {
      browse: async () => null,
      file: async () => SAMPLE_IMAGE_ICON,
      link: async () => {
        throw new Error("링크에서 이미지를 가져오지 못했어요. 주소를 확인해 주세요.");
      },
    },
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(c.getByRole("button", { name: "페이지 아이콘 바꾸기" }));
    await userEvent.click(await body.findByRole("tab", { name: "아이콘" }));
    await userEvent.type(body.getByRole("searchbox", { name: "아이콘 검색" }), "커피");
    await userEvent.click(body.getByRole("button", { name: "커피 카페" }));
    await expect(body.queryByRole("tab", { name: "아이콘" })).not.toBeInTheDocument();
    const trigger = c.getByRole("button", { name: "페이지 아이콘 바꾸기" });
    await expect(trigger.querySelector("svg")).toBeInTheDocument();
  },
};

/** 업로드 탭 — 링크를 못 가져오면 안내가 보인다 */
export const UploadError: Story = {
  args: PickIcon.args,
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(c.getByRole("button", { name: "페이지 아이콘 바꾸기" }));
    await userEvent.click(await body.findByRole("tab", { name: "업로드" }));
    await userEvent.type(
      body.getByRole("textbox", { name: "이미지 링크" }),
      "https://example.com/a.png",
    );
    await userEvent.click(body.getByRole("button", { name: "올리기" }));
    await expect(await body.findByRole("alert")).toHaveTextContent("가져오지 못했어요");
  },
};
