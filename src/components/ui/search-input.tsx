import { cn } from "@/lib/utils";
import { Search, X } from "lucide-react";
import type * as React from "react";
import { inputClass } from "./input";
import { focusRing } from "./styles";

type SearchInputProps = Omit<React.ComponentProps<"input">, "type" | "onChange"> & {
  value: string;
  onValueChange: (value: string) => void;
  /** 지우기 버튼의 이름 */
  clearLabel?: string;
};

/** UI-SearchInput — 돋보기 아이콘 + 값이 있을 때 지우기 버튼. Esc로도 지운다. */
function SearchInput({
  className,
  value,
  onValueChange,
  clearLabel = "검색어 지우기",
  onKeyDown,
  ...props
}: SearchInputProps) {
  return (
    <div data-slot="search-input" className={cn("relative", className)}>
      <Search
        strokeWidth={1.5}
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tertiary"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && value) {
            e.preventDefault();
            onValueChange("");
          }
          onKeyDown?.(e);
        }}
        className={cn(inputClass, "pl-9 [&::-webkit-search-cancel-button]:hidden", value && "pr-9")}
        {...props}
      />
      {value ? (
        <button
          type="button"
          aria-label={clearLabel}
          onClick={() => onValueChange("")}
          className={cn(
            "absolute top-1/2 right-1 grid size-6 -translate-y-1/2 place-items-center rounded-pill text-tertiary hover:bg-hover hover:text-primary force-hover:bg-hover",
            focusRing,
          )}
        >
          <X strokeWidth={1.5} className="size-3.5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

export { SearchInput, type SearchInputProps };
