import { cn } from "@/lib/utils";
import type * as React from "react";
import { fieldFocus } from "./styles";

/** UI-Input — 프로토타입 .input. 오류는 aria-invalid로 표시한다. */
const inputClass = cn(
  "min-h-8 w-full min-w-0 rounded-pill border border-line-control bg-app px-4 text-ui text-primary",
  "transition-[border-color,box-shadow] placeholder:text-tertiary",
  "hover:border-tertiary force-hover:border-tertiary",
  fieldFocus,
  "disabled:cursor-not-allowed disabled:opacity-50",
  "aria-invalid:border-danger aria-invalid:focus-visible:ring-danger-soft",
);

function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return <input type={type} data-slot="input" className={cn(inputClass, className)} {...props} />;
}

export { Input, inputClass };
