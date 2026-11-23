import { DropdownMenu as Primitive } from "radix-ui";
import type * as React from "react";
import {
  CheckMark,
  cx,
  menuContent,
  menuIndicatorSlot,
  menuItem,
  menuItemDanger,
  MenuItemInner,
  menuLabel,
  menuSeparator,
  SubArrow,
} from "./menu-parts";
import { keepMovedFocus } from "./menu-focus";
import { popoverSurface } from "./styles";

/** OV-Menu — 버튼으로 여는 메뉴 (프로토타입 .popover + .menu-item) */
const DropdownMenu = Primitive.Root;
const DropdownMenuTrigger = Primitive.Trigger;
const DropdownMenuGroup = Primitive.Group;
const DropdownMenuSub = Primitive.Sub;

function DropdownMenuContent({
  className,
  sideOffset = 6,
  align = "start",
  onCloseAutoFocus,
  ...props
}: React.ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        data-slot="menu-content"
        sideOffset={sideOffset}
        align={align}
        className={cx(popoverSurface, menuContent, className)}
        {...props}
        onCloseAutoFocus={(e) => keepMovedFocus(e, onCloseAutoFocus)}
      />
    </Primitive.Portal>
  );
}

type ItemExtra = {
  icon?: React.ReactNode;
  /** 오른쪽에 보일 단축키 (UI-Kbd 또는 텍스트) */
  shortcut?: React.ReactNode;
  variant?: "default" | "danger";
};

function DropdownMenuItem({
  className,
  icon,
  shortcut,
  variant = "default",
  children,
  ...props
}: React.ComponentProps<typeof Primitive.Item> & ItemExtra) {
  return (
    <Primitive.Item
      data-slot="menu-item"
      data-variant={variant}
      className={cx(menuItem, variant === "danger" && menuItemDanger, className)}
      {...props}
    >
      <MenuItemInner icon={icon} right={shortcut}>
        {children}
      </MenuItemInner>
    </Primitive.Item>
  );
}

function DropdownMenuCheckboxItem({
  className,
  children,
  icon,
  shortcut,
  ...props
}: React.ComponentProps<typeof Primitive.CheckboxItem> & Pick<ItemExtra, "icon" | "shortcut">) {
  const indicator = (
    <span className={menuIndicatorSlot}>
      <Primitive.ItemIndicator>
        <CheckMark />
      </Primitive.ItemIndicator>
    </span>
  );
  return (
    <Primitive.CheckboxItem
      data-slot="menu-checkbox-item"
      className={cx(menuItem, className)}
      {...props}
    >
      {/* 아이콘이 있으면 다른 항목과 아이콘 줄을 맞추고 체크는 오른쪽 끝에 */}
      {icon ? null : indicator}
      <MenuItemInner icon={icon} right={shortcut}>
        {children}
      </MenuItemInner>
      {icon ? indicator : null}
    </Primitive.CheckboxItem>
  );
}

function DropdownMenuRadioGroup(props: React.ComponentProps<typeof Primitive.RadioGroup>) {
  return <Primitive.RadioGroup data-slot="menu-radio-group" {...props} />;
}

/** 단일 선택 항목 (menuitemradio). 체크 표시는 CheckboxItem과 같다 */
function DropdownMenuRadioItem({
  className,
  children,
  icon,
  shortcut,
  ...props
}: React.ComponentProps<typeof Primitive.RadioItem> & Pick<ItemExtra, "icon" | "shortcut">) {
  const indicator = (
    <span className={menuIndicatorSlot}>
      <Primitive.ItemIndicator>
        <CheckMark />
      </Primitive.ItemIndicator>
    </span>
  );
  return (
    <Primitive.RadioItem data-slot="menu-radio-item" className={cx(menuItem, className)} {...props}>
      {icon ? null : indicator}
      <MenuItemInner icon={icon} right={shortcut}>
        {children}
      </MenuItemInner>
      {icon ? indicator : null}
    </Primitive.RadioItem>
  );
}

function DropdownMenuLabel({ className, ...props }: React.ComponentProps<typeof Primitive.Label>) {
  return <Primitive.Label data-slot="menu-label" className={cx(menuLabel, className)} {...props} />;
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof Primitive.Separator>) {
  return (
    <Primitive.Separator
      data-slot="menu-separator"
      className={cx(menuSeparator, className)}
      {...props}
    />
  );
}

function DropdownMenuSubTrigger({
  className,
  icon,
  children,
  ...props
}: React.ComponentProps<typeof Primitive.SubTrigger> & Pick<ItemExtra, "icon">) {
  return (
    <Primitive.SubTrigger
      data-slot="menu-sub-trigger"
      className={cx(menuItem, "data-[state=open]:bg-hover", className)}
      {...props}
    >
      <MenuItemInner icon={icon}>{children}</MenuItemInner>
      <SubArrow />
    </Primitive.SubTrigger>
  );
}

/**
 * 하위 메뉴. 기준은 부모 메뉴 안의 행이라, 부모의 안쪽 여백(4px)만큼 겹치지 않게 그 바깥으로 2px 띄우고(6),
 * 첫 항목이 트리거 행과 같은 높이에 오게 자기 여백만큼 올린다(-4). 프로토타입 `.submenu > .popover`와 같다.
 */
function DropdownMenuSubContent({
  className,
  sideOffset = 6,
  alignOffset = -4,
  ...props
}: React.ComponentProps<typeof Primitive.SubContent>) {
  return (
    <Primitive.Portal>
      <Primitive.SubContent
        data-slot="menu-sub-content"
        sideOffset={sideOffset}
        alignOffset={alignOffset}
        className={cx(popoverSurface, menuContent, className)}
        {...props}
      />
    </Primitive.Portal>
  );
}

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
};
