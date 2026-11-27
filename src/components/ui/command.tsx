import { useMessages } from "@/lib/i18n";
import { Command as CommandPrimitive } from "cmdk";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import type * as React from "react";
import { menuItem } from "./styles";

/** OV-CommandPalette — 프로토타입 .palette (640px, --r-xl, 위쪽 12vh) */
function Command({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      data-slot="command"
      className={cn(
        "grid max-h-[calc(var(--fit-h)*0.68)] w-160 max-w-[calc(var(--fit-w)-var(--s8))] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-xl bg-elevated text-primary shadow-modal",
        className,
      )}
      {...props}
    />
  );
}

function CommandDialog({
  open,
  onOpenChange,
  title: titleProp,
  children,
  ...props
}: React.ComponentProps<typeof CommandPrimitive> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
}) {
  const m = useMessages();
  const title = titleProp ?? m.ui.command.title;
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-scrim data-[state=open]:animate-fade" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 top-(--palette-top) z-50 mx-auto w-fit outline-none data-[state=open]:animate-rise"
        >
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          <Command loop {...props}>
            {children}
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function CommandInput({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
  const m = useMessages();
  return (
    <div className="flex items-center gap-3 border-b border-line px-4 py-3">
      <Search strokeWidth={1.5} className="size-4 shrink-0 text-tertiary" aria-hidden />
      <CommandPrimitive.Input
        data-slot="command-input"
        aria-label={m.ui.command.search}
        className={cn(
          "min-w-0 flex-1 border-0 bg-transparent text-body text-primary outline-none placeholder:text-tertiary",
          className,
        )}
        {...props}
      />
    </div>
  );
}

function CommandList({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn("min-h-0 overflow-y-auto p-1", className)}
      {...props}
    />
  );
}

function CommandEmpty({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      data-slot="command-empty"
      className={cn("px-4 py-8 text-center text-ui text-tertiary", className)}
      {...props}
    />
  );
}

function CommandGroup({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={cn(
        "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-label [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-(--tracking-label) [&_[cmdk-group-heading]]:text-tertiary",
        className,
      )}
      {...props}
    />
  );
}

function CommandSeparator({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator className={cn("-mx-1 my-1 h-px bg-line", className)} {...props} />
  );
}

/** 결과 행: 아이콘 · 제목 · (스니펫/경로) · 오른쪽 */
function CommandItem({
  className,
  icon,
  description,
  right,
  children,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item> & {
  icon?: React.ReactNode;
  /** 스니펫이나 경로 (보조 줄) */
  description?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cn(
        menuItem,
        "rounded-lg data-[selected=true]:bg-hover",
        // 두 줄 결과 행: 프로토타입 .result (간격 s3, 안쪽 여백 s2, 위 정렬, 제목 500)
        description && "items-start gap-3 p-2 [&>svg]:mt-0.75",
        className,
      )}
      {...props}
    >
      {icon}
      <span className="grid min-w-0 flex-1">
        <span className={cn("truncate", description && "font-medium")}>{children}</span>
        {description ? (
          <span className="truncate text-label text-tertiary">{description}</span>
        ) : null}
      </span>
      {right ? <span className="ml-2 shrink-0 text-label text-tertiary">{right}</span> : null}
    </CommandPrimitive.Item>
  );
}

/** 검색어와 일치하는 부분을 강조한다 (대소문자 무시) */
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const i = text.toLowerCase().indexOf(query.toLowerCase());
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-xs bg-accent-soft px-0.5 font-medium text-accent">
        {text.slice(i, i + query.length)}
      </mark>
      {text.slice(i + query.length)}
    </>
  );
}

function CommandFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="command-footer"
      className={cn(
        "flex items-center gap-4 border-t border-line px-4 py-2 text-label text-tertiary [&>span]:inline-flex [&>span]:items-center [&>span]:gap-1",
        className,
      )}
      {...props}
    />
  );
}

export {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  Highlight,
};
