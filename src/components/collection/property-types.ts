import type { SoftColor } from "@/components/ui/tag-chip";
import { msg } from "@/lib/i18n";
import {
  AtSign,
  Binary,
  Calendar,
  CalendarDays,
  CircleChevronDown,
  CircleDot,
  Clock,
  Hash,
  History,
  Link,
  ListChecks,
  Phone,
  SquareCheck,
  Type,
  User,
  type LucideIcon,
} from "lucide-react";

/* ---------- 모양 (저장 형식과 같은 이름, components는 lib/storage를 모른다) ---------- */

export type PropertyType =
  | "text"
  | "number"
  | "select"
  | "multi"
  | "date"
  | "checkbox"
  | "url"
  | "email"
  | "phone"
  | "created"
  | "updated";
export type BuiltinKey = "status" | "assignee" | "due" | "tags";
export type PropertyOption = { name: string; color: SoftColor };
/** 사용자 속성 정의 */
export type CustomProperty = {
  id: string;
  name: string;
  type: PropertyType;
  options: PropertyOption[];
};
/** 레코드 값 하나 */
export type PropertyValue = string | number | boolean | string[] | null;
/** 속성 순서 한 칸 — 메뉴·목록이 보여 줄 모양 */
export type PropertyEntry = {
  key: string;
  name: string;
  /** 기본 속성이면 그 이름, 아니면 사용자 속성 종류 */
  kind: BuiltinKey | PropertyType;
  builtin: boolean;
  hidden: boolean;
  card: boolean;
};

const PROPERTY_TYPE_KEYS: readonly PropertyType[] = [
  "text",
  "number",
  "select",
  "multi",
  "date",
  "checkbox",
  "url",
  "email",
  "phone",
  "created",
  "updated",
];
/** 종류 이름 — 읽는 순간의 언어로 정해진다 (getter) */
export const PROPERTY_TYPE_NAMES = {} as Record<PropertyType, string>;
for (const k of PROPERTY_TYPE_KEYS) {
  Object.defineProperty(PROPERTY_TYPE_NAMES, k, {
    get: () => msg().collection.model.fieldType[k],
    enumerable: true,
  });
}
export const ADDABLE = [...PROPERTY_TYPE_KEYS];

export const PROPERTY_ICONS: Record<BuiltinKey | PropertyType, LucideIcon> = {
  status: CircleDot,
  assignee: User,
  due: CalendarDays,
  tags: Hash,
  text: Type,
  number: Binary,
  select: CircleChevronDown,
  multi: ListChecks,
  date: Calendar,
  checkbox: SquareCheck,
  url: Link,
  email: AtSign,
  phone: Phone,
  created: Clock,
  updated: History,
};
