import { useMessages } from "@/lib/i18n";
import { cva, type VariantProps } from "class-variance-authority";
import { motionTokens } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import * as React from "react";

type Star = { id: string; bayer: string; x: number; y: number; mag: number; name?: string };

/**
 * 고래자리(Cetus) 주요 별 — 실제 적경·적위를 평면에 투영한 근삿값(왼쪽이 동쪽), 등급은 겉보기 등급.
 * 프로토타입 components.html §25와 같은 좌표다. (docs/design/concept.md)
 */
const STARS: Star[] = [
  { id: "alpha", bayer: "α", x: 9.9, y: 24.7, mag: 2.54, name: "멘카르" }, // i18n-ignore
  { id: "lambda", bayer: "λ", x: 11.5, y: 12.8, mag: 4.7 },
  { id: "mu", bayer: "μ", x: 20.5, y: 9.9, mag: 4.27 },
  { id: "xi2", bayer: "ξ²", x: 30.9, y: 13.9, mag: 4.3 },
  { id: "nu", bayer: "ν", x: 25.7, y: 21, mag: 4.86 },
  { id: "gamma", bayer: "γ", x: 21.5, y: 26.8, mag: 3.47 },
  { id: "delta", bayer: "δ", x: 23.9, y: 34, mag: 4.07 },
  { id: "omicron", bayer: "ο", x: 36.3, y: 42.2, mag: 3, name: "미라" }, // i18n-ignore
  { id: "zeta", bayer: "ζ", x: 53.5, y: 60.4, mag: 3.73, name: "바텐 카이토스" }, // i18n-ignore
  { id: "theta", bayer: "θ", x: 70.4, y: 55, mag: 3.6 },
  { id: "eta", bayer: "η", x: 79.9, y: 60, mag: 3.45 },
  { id: "iota", bayer: "ι", x: 110.1, y: 56.6, mag: 3.56 },
  { id: "beta", bayer: "β", x: 95.3, y: 79.2, mag: 2.04, name: "디프다" }, // i18n-ignore
  { id: "tau", bayer: "τ", x: 58, y: 74.2, mag: 3.5 },
];

/** 머리(α λ μ ξ² ν γ) → 목(γ δ ο ζ) → 몸통(ζ θ η ι β τ) */
const LINES: [string, string][] = [
  ["alpha", "lambda"],
  ["lambda", "mu"],
  ["mu", "xi2"],
  ["xi2", "nu"],
  ["nu", "gamma"],
  ["gamma", "alpha"],
  ["gamma", "delta"],
  ["delta", "omicron"],
  ["omicron", "zeta"],
  ["zeta", "theta"],
  ["theta", "eta"],
  ["eta", "iota"],
  ["iota", "beta"],
  ["beta", "tau"],
  ["tau", "zeta"],
];

const VIEW_BOX = "0 0 120 89.1";
const byId = Object.fromEntries(STARS.map((s) => [s.id, s]));
/** 밝을수록(등급이 작을수록) 큰 점 */
const radius = (mag: number) => 0.8 + (5 - mag) * 0.45;
/**
 * 배경 잔별 (radiant) — 고래자리 둘레의 희미한 별. 깊이감만 주는 장식이라 위치는 고정값이다.
 * [x, y, 반지름]. 셋에 하나만 반짝인다(애니메이션 수를 줄인다).
 */
const DUST: [number, number, number][] = [
  [4, 8, 0.35],
  [16, 40, 0.3],
  [33, 4, 0.4],
  [44, 22, 0.3],
  [40, 58, 0.35],
  [62, 12, 0.3],
  [72, 30, 0.4],
  [88, 20, 0.3],
  [103, 10, 0.35],
  [116, 30, 0.3],
  [96, 44, 0.35],
  [115, 78, 0.3],
  [84, 86, 0.35],
  [66, 84, 0.3],
  [44, 76, 0.35],
  [28, 66, 0.3],
  [8, 52, 0.35],
  [52, 44, 0.3],
];

/** 십자 빛줄기를 그릴 밝은 별 (2.6등급보다 밝은 멘카르·디프다) + 미라 */
const flares = (s: Star) => s.mag < 2.6 || s.id === "omicron";
/**
 * 별마다 다른 반짝임 박자 — 같은 박자로 깜빡이면 기계적으로 보인다.
 * 길이는 --dur-twinkle의 0.35~0.65배, 시작점은 음수 지연으로 흩어 둔다(별 순서로 정해져 늘 같다).
 */
const beat = (i: number): React.CSSProperties => {
  const k = 0.35 + ((i * 37) % 10) / 33;
  const shift = ((i * 53) % 10) / 10;
  return {
    animationDuration: `calc(var(--dur-twinkle) * ${k.toFixed(2)})`,
    animationDelay: `calc(var(--dur-twinkle) * ${(-k * shift).toFixed(2)})`,
    transformBox: "fill-box",
    transformOrigin: "center",
  };
};

const constellationVariants = cva("block h-auto shrink-0 overflow-visible", {
  variants: {
    /** sm 로고(48) · md 빈 상태·홈(320) · lg 페이지 배경 여백(200) */
    size: { sm: "w-12", md: "w-80", lg: "w-50" },
    /** strong = 또렷하게(빈 상태·홈) · faint = 옅게(본문 옆 배경) */
    tone: { strong: "opacity-(--sky-strong)", faint: "opacity-(--sky-faint)" },
  },
  defaultVariants: { size: "md", tone: "strong" },
});

type ConstellationProps = Omit<React.ComponentProps<"svg">, "children"> &
  VariantProps<typeof constellationVariants> & {
    /** 이름 있는 별(멘카르 · 미라 · 바텐 카이토스 · 디프다)을 적는다 */
    labels?: boolean;
    /**
     * 별이 저마다 반짝이고 둘레에 옅은 빛이 번진다(밝은 별은 십자 빛줄기). faint·sm에서는 늘 꺼진다
     * (본문 옆·로고에서 움직이지 않음). 동작 줄이기면 멈춘다.
     */
    twinkle?: boolean;
    /**
     * 빛의 세기. soft = 옅은 번짐(홈·빈 상태) · radiant = 광원처럼(스플래시·첫 설정·홈):
     * 방사형 번짐 + 흰 심 + 끝이 사라지는 빛줄기 + 배경 잔별. 블러 필터 없이 그라데이션 도형만 쓰고
     * 별마다 애니메이션 하나(투명도·크기)로 묶어 가볍게 그린다.
     */
    glow?: "soft" | "radiant";
    /** 주면 그림으로 읽힌다(role="img"). 없으면 장식(aria-hidden) */
    title?: string;
    /**
     * 별이 머리부터 하나씩 켜지고 선이 이어진다(스플래시, PG-Splash). 동작 줄이기면 바로 다 보인다.
     * 끝나면 onRevealEnd. 시간은 모션 토큰으로 계산한다(별 간격 = --dur-fast/2, 선 간격 = --dur-fast/3).
     */
    reveal?: boolean;
    onRevealEnd?: () => void;
  };

/**
 * UI-Constellation — CetusNote의 브랜드 모티프, 고래자리.
 * 점과 가는 선, 그리고 반짝일 때만 번지는 옅은 빛(2026-11-20 사용자 요청 — 움직이는 별자리).
 * 색은 `--sky-*` 토큰, 미라만 따뜻한 색. soft는 그라데이션 없이 같은 색 원의 불투명도로, radiant(스플래시·첫 설정·홈)만 별 둘레에 방사형 그라데이션을 쓴다.
 */
function Constellation({
  size,
  tone,
  labels = false,
  twinkle = true,
  glow = "soft",
  title,
  reveal = false,
  onRevealEnd,
  className,
  ...props
}: ConstellationProps) {
  const m = useMessages();
  const small = size === "sm";
  const animate = twinkle && tone !== "faint" && !small;
  const reduced = useReducedMotion();
  const play = reveal && !reduced;
  const radiant = glow === "radiant" && !small;
  // 그려지는 중(reveal)에는 빛을 끄고, 별이 다 켜지면 켠다(선이 이어지는 동안 빛이 번진다)
  const [lit, setLit] = React.useState(!play);
  const showGlow = animate && (!play || lit);
  const uid = React.useId().replace(/:/g, "");
  const gid = (name: string) => `${uid}-${name}`;
  const t = motionTokens();
  const starGap = t.fast / 2;
  const lineGap = t.fast / 3;
  // 선은 별이 절반쯤 켜졌을 때부터 잇는다
  const lineStart = STARS.length * starGap * 0.5;
  const onEnd = React.useRef(onRevealEnd);
  React.useLayoutEffect(() => {
    onEnd.current = onRevealEnd;
  });
  // 동작 줄이기: 애니메이션 없이 바로 끝난 것으로 본다
  React.useEffect(() => {
    if (reveal && reduced) onEnd.current?.();
  }, [reveal, reduced]);
  return (
    <svg
      data-slot="constellation"
      viewBox={VIEW_BOX}
      className={cn(constellationVariants({ size, tone }), className)}
      {...(title ? { role: "img", "aria-label": title } : { "aria-hidden": true })}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {/* 로고 크기에서는 선을 굵게, 점을 크게 해 작아도 고래 모양이 보이게 한다 */}
      <g
        className="stroke-sky-line"
        strokeWidth={small ? 1.6 : 0.45}
        strokeLinecap="round"
        fill="none"
      >
        {LINES.map(([a, b], i) => {
          const p = byId[a]!;
          const q = byId[b]!;
          const pos = { x1: p.x, y1: p.y, x2: q.x, y2: q.y };
          if (!play) return <line key={`${a}-${b}`} {...pos} />;
          const last = i === LINES.length - 1;
          return (
            <motion.line
              key={`${a}-${b}`}
              {...pos}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: t.slow, ease: t.ease, delay: lineStart + i * lineGap }}
              onAnimationComplete={last ? () => onEnd.current?.() : undefined}
            />
          );
        })}
      </g>
      {radiant && (!play || lit) ? <RadiantDefs id={gid} /> : null}
      {radiant && (!play || lit) ? (
        // 배경 잔별 — 별자리보다 뒤, 옅게
        <motion.g
          aria-hidden
          className="fill-sky-star"
          initial={play ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ duration: t.slow, ease: t.ease }}
        >
          <g className="opacity-(--sky-dust)">
            {DUST.map(([x, y, r], i) => (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={r}
                data-twinkle={animate && i % 3 === 0 ? "" : undefined}
                className={animate && i % 3 === 0 ? "animate-star" : undefined}
                style={animate && i % 3 === 0 ? beat(i + 5) : undefined}
              />
            ))}
          </g>
        </motion.g>
      ) : null}
      {/* 반짝임의 빛 — 별 뒤의 번짐과 십자 빛줄기. 별이 밝아질 때 함께 번진다 */}
      {showGlow && radiant ? (
        <motion.g
          aria-hidden
          initial={play ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ duration: t.slow, ease: t.ease }}
        >
          {STARS.map((s, i) => {
            const mira = s.id === "omicron";
            const r = radius(s.mag);
            const bright = s.mag < 3.6 || mira;
            const len = r * (s.mag < 2.6 ? 7 : 4.5);
            const w = 0.3;
            const tone = mira ? "m" : "s";
            return (
              <g key={s.id} data-twinkle="" className="animate-star-breathe" style={beat(i)}>
                <circle cx={s.x} cy={s.y} r={r * 5.5} fill={`url(#${gid(`halo-${tone}`)})`} />
                {bright ? (
                  <>
                    <rect
                      x={s.x - len}
                      y={s.y - w / 2}
                      width={len * 2}
                      height={w}
                      fill={`url(#${gid(`ray-h-${tone}`)})`}
                    />
                    <rect
                      x={s.x - w / 2}
                      y={s.y - len}
                      width={w}
                      height={len * 2}
                      fill={`url(#${gid(`ray-v-${tone}`)})`}
                    />
                  </>
                ) : null}
              </g>
            );
          })}
        </motion.g>
      ) : null}
      {showGlow && !radiant ? (
        <g aria-hidden>
          {STARS.map((s, i) => {
            const mira = s.id === "omicron";
            const r = radius(s.mag);
            return (
              <React.Fragment key={s.id}>
                <circle
                  data-twinkle=""
                  cx={s.x}
                  cy={s.y}
                  r={r * 2.6}
                  className={cn("animate-star-glow", mira ? "fill-sky-mira" : "fill-sky-glow")}
                  style={beat(i)}
                />
                {flares(s) ? (
                  <path
                    data-twinkle=""
                    d={`M${s.x - r * 3.4} ${s.y}H${s.x + r * 3.4}M${s.x} ${s.y - r * 3.4}V${s.y + r * 3.4}`}
                    strokeWidth={0.35}
                    strokeLinecap="round"
                    className={cn(
                      "animate-star-flare",
                      mira ? "stroke-sky-mira" : "stroke-sky-glow",
                    )}
                    style={beat(i)}
                  />
                ) : null}
              </React.Fragment>
            );
          })}
        </g>
      ) : null}
      <g>
        {STARS.map((s, i) => {
          const mira = s.id === "omicron";
          const circle = {
            cx: s.x,
            cy: s.y,
            r: radius(s.mag) * (small ? 1.8 : 1),
            className: cn(
              mira ? "fill-sky-mira" : "fill-sky-star",
              // radiant는 별 점은 가만히 두고 빛만 숨 쉰다(애니메이션 수를 반으로)
              animate && !play && !radiant && "animate-star",
            ),
            "data-twinkle": animate && !radiant ? "" : undefined,
            style: animate && !play && !radiant ? beat(i) : undefined,
          };
          if (!play) return <circle key={s.id} {...circle} />;
          return (
            <motion.circle
              key={s.id}
              {...circle}
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: t.slow, ease: t.ease, delay: i * starGap }}
              onAnimationComplete={i === STARS.length - 1 ? () => setLit(true) : undefined}
            />
          );
        })}
      </g>
      {radiant && (!play || lit) ? (
        // 흰 심 — 빛을 내는 점처럼 보이게. 정적이라 비용이 없다
        <g aria-hidden className="fill-sky-core">
          {STARS.map((s) => (
            <circle key={s.id} cx={s.x} cy={s.y} r={radius(s.mag) * 0.34} />
          ))}
        </g>
      ) : null}
      {labels && !small ? (
        <g className="fill-tertiary font-sans" fontSize={3.2}>
          {STARS.filter((s) => s.name).map((s) => (
            <text key={s.id} x={s.x + 2.4} y={s.y - 2.2}>
              {(m.ui.constellation.names as Record<string, string>)[s.id] ?? s.name}
            </text>
          ))}
        </g>
      ) : null}
    </svg>
  );
}

/**
 * radiant 그라데이션 — 번짐(방사형)과 빛줄기(가운데가 진하고 양 끝이 사라지는 선형).
 * 색은 --sky-glow · --sky-mira 토큰. s = 별, m = 미라.
 */
function RadiantDefs({ id }: { id: (name: string) => string }) {
  const tones = [
    ["s", "var(--sky-glow)"],
    ["m", "var(--sky-mira)"],
  ] as const;
  return (
    <defs>
      {tones.map(([k, color]) => (
        <React.Fragment key={k}>
          <radialGradient id={id(`halo-${k}`)}>
            <stop offset="0" style={{ stopColor: color }} stopOpacity={0.9} />
            <stop offset="0.18" style={{ stopColor: color }} stopOpacity={0.45} />
            <stop offset="0.5" style={{ stopColor: color }} stopOpacity={0.12} />
            <stop offset="1" style={{ stopColor: color }} stopOpacity={0} />
          </radialGradient>
          {(["h", "v"] as const).map((dir) => (
            <linearGradient
              key={dir}
              id={id(`ray-${dir}-${k}`)}
              x1="0"
              y1="0"
              x2={dir === "h" ? "1" : "0"}
              y2={dir === "h" ? "0" : "1"}
            >
              <stop offset="0" style={{ stopColor: color }} stopOpacity={0} />
              <stop offset="0.5" style={{ stopColor: color }} stopOpacity={0.95} />
              <stop offset="1" style={{ stopColor: color }} stopOpacity={0} />
            </linearGradient>
          ))}
        </React.Fragment>
      ))}
    </defs>
  );
}

export { Constellation, constellationVariants, type ConstellationProps };
