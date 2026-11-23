import { ContextMenu as Primitive } from "radix-ui";
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

/** OV-Menu — 우클릭 메뉴 (프로토타입 .popover + .menu-item) */
const ContextMenu = Primitive.Root;
const ContextMenuTrigger = Primitive.Trigger;
const ContextMenuGroup = Primitive.Group;
const ContextMenuSub = Primitive.Sub;

function ContextMenuContent({
  className,
  onCloseAutoFocus,
  ...props
}: React.ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        data-slot="menu-content"
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

function ContextMenuItem({
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

function ContextMenuCheckboxItem({
  className,
  children,
  shortcut,
  ...props
}: React.ComponentProps<typeof Primitive.CheckboxItem> & Pick<ItemExtra, "shortcut">) {
  return (
    <Primitive.CheckboxItem
      data-slot="menu-checkbox-item"
      className={cx(menuItem, className)}
      {...props}
    >
      <span className={menuIndicatorSlot}>
        <Primitive.ItemIndicator>
          <CheckMark />
        </Primitive.ItemIndicator>
      </span>
      <MenuItemInner right={shortcut}>{children}</MenuItemInner>
    </Primitive.CheckboxItem>
  );
}

function ContextMenuLabel({ className, ...props }: React.ComponentProps<typeof Primitive.Label>) {
  return <Primitive.Label data-slot="menu-label" className={cx(menuLabel, className)} {...props} />;
}

function ContextMenuSeparator({
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

function ContextMenuSubTrigger({
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
function ContextMenuSubContent({
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
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
};
