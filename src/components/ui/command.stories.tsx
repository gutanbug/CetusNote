import type { Meta, StoryObj } from "@storybook/react-vite";
import { ArrowDownUp, CornerDownLeft, FilePlus2, FileText, Moon, Settings } from "lucide-react";
import { useState } from "react";
import { Button } from "./button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Highlight,
} from "./command";
import { Kbd } from "./kbd";

const meta = {
  title: "L2 오버레이/OV-CommandPalette",
  component: Command,
} satisfies Meta<typeof Command>;
export default meta;
type Story = StoryObj<typeof meta>;

const ic = { strokeWidth: 1.5 } as const;
const PAGES = [
  { title: "회의록 11/18", path: "업무 / 회의", snippet: "다음 스프린트 범위와 회의록 공유 방식" },
  { title: "주간 회고", path: "개인", snippet: "이번 주 회의가 너무 많았다" },
  { title: "독서 노트 — 사피엔스", path: "개인 / 독서", snippet: "인지 혁명 이후" },
];

function Palette() {
  const [q, setQ] = useState("회의");
  return (
    <>
      <CommandInput value={q} onValueChange={setQ} placeholder="페이지 검색 또는 명령 입력" />
      <CommandList>
        <CommandEmpty>“{q}”와 일치하는 페이지가 없어요.</CommandEmpty>
        <CommandGroup heading="결과">
          {PAGES.map((p) => (
            <CommandItem
              key={p.title}
              value={`${p.title} ${p.snippet}`}
              icon={<FileText {...ic} />}
              description={
                <>
                  {p.path} · <Highlight text={p.snippet} query={q} />
                </>
              }
            >
              <Highlight text={p.title} query={q} />
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="명령">
          <CommandItem
            value="새 페이지"
            icon={<FilePlus2 {...ic} />}
            right={<Kbd keys={["⌘", "N"]} />}
          >
            새 페이지
          </CommandItem>
          <CommandItem value="다크 모드로 전환" icon={<Moon {...ic} />}>
            다크 모드로 전환
          </CommandItem>
          <CommandItem
            value="설정 열기"
            icon={<Settings {...ic} />}
            right={<Kbd keys={["⌘", ","]} />}
          >
            설정 열기
          </CommandItem>
        </CommandGroup>
      </CommandList>
      <CommandFooter>
        <span>
          <ArrowDownUp {...ic} className="size-3.5" aria-hidden /> 이동
        </span>
        <span>
          <CornerDownLeft {...ic} className="size-3.5" aria-hidden /> 열기
        </span>
        <span>
          <Kbd keys={["Esc"]} /> 닫기
        </span>
      </CommandFooter>
    </>
  );
}

/** 결과 · 하이라이트 · 스니펫·경로 · 명령 그룹 · 하단 키 안내 */
export const Inline: Story = {
  render: () => (
    <Command label="명령 팔레트" loop>
      <Palette />
    </Command>
  ),
};

/** 빈 결과 */
export const Empty: Story = {
  // cmdk는 결과가 없을 때 빈 listbox를 남긴다(라이브러리 동작). 화면에서는 문구가 읽히므로 이 규칙만 끈다.
  parameters: { a11y: { config: { rules: [{ id: "aria-required-children", enabled: false }] } } },
  render: () => (
    <Command label="명령 팔레트">
      <CommandInput value="ㅋㅋㅋ" placeholder="페이지 검색 또는 명령 입력" readOnly />
      <CommandList>
        <CommandEmpty>“ㅋㅋㅋ”와 일치하는 페이지가 없어요.</CommandEmpty>
      </CommandList>
      <CommandFooter>
        <span>
          <Kbd keys={["Esc"]} /> 닫기
        </span>
      </CommandFooter>
    </Command>
  ),
};

/** ⌘K 모달 (scrim, 위쪽 12vh) */
export const AsDialog: Story = {
  render: function Render() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          명령 팔레트 열기
        </Button>
        <CommandDialog open={open} onOpenChange={setOpen}>
          <Palette />
        </CommandDialog>
      </>
    );
  },
};
