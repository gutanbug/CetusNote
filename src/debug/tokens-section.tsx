import { Button } from "@/components/ui/button";
import { SOFT_COLORS } from "@/components/ui/tag-chip";
import { cn } from "@/lib/utils";
import {
  Bold,
  Check,
  ChevronDown,
  ChevronRight,
  Code,
  Copy,
  FileText,
  Hash,
  Heading1,
  Italic,
  Link,
  List,
  ListChecks,
  MoreHorizontal,
  Plus,
  Quote,
  Search,
  Settings,
  Sigma,
  Smile,
  Star,
  Table,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { ACCENTS } from "./settings";

// Tokens 섹션 — 실제 CSS 변수를 읽어 그린다. 값을 여기에 적지 않는다 (debug-screen.md §5).

const COLORS = [
  "--bg-app",
  "--bg-sidebar",
  "--bg-subtle",
  "--bg-hover",
  "--bg-active",
  "--bg-elevated",
  "--border-subtle",
  "--border-strong",
  "--text-primary",
  "--text-secondary",
  "--text-tertiary",
  "--accent",
  "--accent-soft",
  "--accent-on",
  "--sel-bg",
  "--sel-fg",
  "--danger",
  "--danger-soft",
  "--danger-on",
  "--inverse-bg",
  "--inverse-fg",
  "--inverse-accent",
  "--code-bg",
  "--inline-code-bg",
  "--inline-code-fg",
  "--knob",
  "--scrim",
];
// Tailwind가 클래스를 찾을 수 있게 전체 이름을 적는다
const FONT_SIZES = [
  ["micro", "text-micro"],
  ["label", "text-label"],
  ["caption", "text-caption"],
  ["ui", "text-ui"],
  ["body", "text-body"],
  ["code", "text-code font-mono"],
  ["h3", "text-h3 font-semibold"],
  ["h2", "text-h2 font-semibold"],
  ["h1", "text-h1 font-bold"],
  ["title", "text-title font-bold"],
] as const;
const SPACING = ["--s1", "--s2", "--s3", "--s4", "--s6", "--s8", "--s12", "--s16"];
const RADII = ["--r-hair", "--r-xs", "--r-sm", "--r-md", "--r-lg", "--r-xl", "--r-pill"];
const SHADOWS = ["--shadow-popover", "--shadow-modal", "--shadow-knob"];
const DURATIONS = ["--dur-fast", "--dur", "--dur-slow"];
const LAYOUT = ["--sidebar-w", "--topbar-h", "--content-w", "--bw-control", "--font-scale"];
const ICONS: [string, LucideIcon][] = [
  ["plus", Plus],
  ["search", Search],
  ["settings", Settings],
  ["trash-2", Trash2],
  ["file-text", FileText],
  ["star", Star],
  ["more-horizontal", MoreHorizontal],
  ["chevron-right", ChevronRight],
  ["chevron-down", ChevronDown],
  ["x", X],
  ["check", Check],
  ["copy", Copy],
  ["hash", Hash],
  ["heading-1", Heading1],
  ["list", List],
  ["list-checks", ListChecks],
  ["quote", Quote],
  ["code", Code],
  ["table", Table],
  ["sigma", Sigma],
  ["bold", Bold],
  ["italic", Italic],
  ["link", Link],
  ["smile", Smile],
];

/** 가장 가까운 테마 열에서 계산된 변수 값을 글자로 보여 준다 (리렌더마다 다시 읽는다) */
function Value({ name, className }: { name: string; className?: string }) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el) el.textContent = getComputedStyle(el).getPropertyValue(name).trim() || "—";
  });
  return <code ref={ref} className={cn("font-mono text-micro text-tertiary", className)} />;
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      <h3 className="text-label font-semibold tracking-(--tracking-label) text-secondary">
        {title}
      </h3>
      {children}
    </section>
  );
}

function MotionDemo() {
  const [on, setOn] = useState(false);
  return (
    <div className="grid gap-3">
      <Button
        size="sm"
        variant="secondary"
        className="justify-self-start"
        onClick={() => setOn(!on)}
      >
        모션 재생
      </Button>
      {DURATIONS.map((d) => (
        <div key={d} className="flex items-center gap-3">
          <span className="w-24 font-mono text-label text-secondary">{d}</span>
          <div className="relative h-6 flex-1 rounded-pill bg-hover">
            <span
              className={cn(
                "absolute top-1 left-1 size-4 rounded-pill bg-accent transition-transform",
                on && "translate-x-40",
              )}
              style={{ transitionDuration: `var(${d})`, transitionTimingFunction: "var(--ease)" }}
            />
          </div>
          <Value name={d} />
        </div>
      ))}
      <div className="flex items-center gap-3">
        <span className="w-24 font-mono text-label text-secondary">--ease</span>
        <Value name="--ease" />
      </div>
    </div>
  );
}

export function TokensSection() {
  return (
    <div className="grid gap-8">
      <Group title="색상">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(--spacing(52),1fr))] gap-2">
          {COLORS.map((c) => (
            <div key={c} className="flex items-center gap-2">
              <span
                className="size-8 shrink-0 rounded-md border border-line"
                style={{ background: `var(${c})` }}
              />
              <div className="grid min-w-0">
                <span className="truncate font-mono text-label">{c}</span>
                <Value name={c} />
              </div>
            </div>
          ))}
        </div>
      </Group>

      <Group title="소프트 컬러 9종">
        <div className="flex flex-wrap gap-2">
          {SOFT_COLORS.map((c) => (
            <span
              key={c}
              className="inline-flex h-7 items-center rounded-pill px-3 text-label font-medium"
              style={{ background: `var(--c-${c}-bg)`, color: `var(--c-${c}-fg)` }}
            >
              {c}
            </span>
          ))}
        </div>
      </Group>

      <Group title="포인트 색 8종">
        <div className="flex flex-wrap gap-4">
          {ACCENTS.map((a) => (
            <div key={a} data-accent={a} className="grid justify-items-center gap-1">
              <span className="flex">
                <span className="size-7 rounded-pill bg-accent" />
                <span className="-ml-2 size-7 rounded-pill border-2 border-app bg-accent-soft" />
              </span>
              <span className="text-label text-secondary">{a}</span>
            </div>
          ))}
        </div>
      </Group>

      <Group title="타이포 스케일">
        <div className="grid gap-2">
          {FONT_SIZES.map(([f, cls]) => (
            <div key={f} className="flex items-baseline gap-4">
              <span className="w-24 shrink-0 font-mono text-label text-secondary">--fs-{f}</span>
              <span className={cn("truncate", cls)}>조용한 위계 Quiet hierarchy 123</span>
              <Value name={`--fs-${f}`} className="ml-auto" />
            </div>
          ))}
        </div>
      </Group>

      <Group title="간격 (4px 리듬)">
        <div className="grid gap-1.5">
          {SPACING.map((s) => (
            <div key={s} className="flex items-center gap-3">
              <span className="w-24 font-mono text-label text-secondary">{s}</span>
              <span className="h-3 rounded-hair bg-accent" style={{ width: `var(${s})` }} />
              <Value name={s} />
            </div>
          ))}
        </div>
      </Group>

      <Group title="반경">
        <div className="flex flex-wrap gap-4">
          {RADII.map((r) => (
            <div key={r} className="grid justify-items-center gap-1">
              <span
                className="size-14 border border-line-strong bg-subtle"
                style={{ borderRadius: `var(${r})` }}
              />
              <span className="font-mono text-label">{r}</span>
              <Value name={r} />
            </div>
          ))}
        </div>
      </Group>

      <Group title="그림자">
        <div className="flex flex-wrap gap-6">
          {SHADOWS.map((s) => (
            <div key={s} className="grid justify-items-center gap-2">
              <span
                className="h-12 w-30 rounded-lg bg-elevated"
                style={{ boxShadow: `var(${s})` }}
              />
              <span className="font-mono text-label">{s}</span>
            </div>
          ))}
        </div>
      </Group>

      <Group title="모션">
        <MotionDemo />
      </Group>

      <Group title="레이아웃 · 기타">
        <div className="grid gap-1">
          {LAYOUT.map((l) => (
            <div key={l} className="flex items-center gap-3">
              <span className="w-28 font-mono text-label text-secondary">{l}</span>
              <Value name={l} />
            </div>
          ))}
        </div>
      </Group>

      <Group title="아이콘 (lucide, 16px · stroke 1.5)">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(--spacing(28),1fr))] gap-2">
          {ICONS.map(([name, Icon]) => (
            <div key={name} className="flex items-center gap-2 text-secondary">
              <Icon className="size-4 shrink-0 text-primary" strokeWidth={1.5} aria-hidden />
              <span className="truncate font-mono text-micro">{name}</span>
            </div>
          ))}
        </div>
      </Group>
    </div>
  );
}
