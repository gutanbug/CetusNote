import { focusRing } from "@/components/ui/styles";
import { cn } from "@/lib/utils";

/** 값 칸 버튼 (프로토타입 .gcell-val) */
export const valueButton = cn(
  "group/val flex min-h-6 w-full min-w-0 items-center gap-1 rounded-md px-1 py-0.5 text-left text-ui",
  "transition-colors duration-(--dur-fast) hover:bg-active force-hover:bg-active",
  focusRing,
);
