import type { SoftColor } from "@/components/ui/tag-chip";

/** 점 색 — 소프트 컬러의 글자 색 (프로토타입 `.tag-dot`: var(--c-<색>-fg)) */
export const TAG_DOT: Record<SoftColor, string> = {
  gray: "bg-gray-fg",
  brown: "bg-brown-fg",
  orange: "bg-orange-fg",
  yellow: "bg-yellow-fg",
  green: "bg-green-fg",
  blue: "bg-blue-fg",
  purple: "bg-purple-fg",
  pink: "bg-pink-fg",
  red: "bg-red-fg",
};
