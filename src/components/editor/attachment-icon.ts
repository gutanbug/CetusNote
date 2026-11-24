import {
  File,
  FileArchive,
  FileCode,
  FileImage,
  FileMusic,
  FileSpreadsheet,
  FileText,
  FileVideoCamera,
  Presentation,
  type LucideIcon,
} from "lucide-react";
import { attachmentKind, extensionOf } from "@/lib/attachments/limits";

// 확장자 → 아이콘 묶음 (ED-FileAttachment). 목록에 없으면 일반 파일 아이콘.
const BY_EXT: Record<string, LucideIcon> = {
  pdf: FileText,
  doc: FileText,
  docx: FileText,
  hwp: FileText,
  hwpx: FileText,
  rtf: FileText,
  txt: FileText,
  md: FileText,
  odt: FileText,
  pages: FileText,
  xls: FileSpreadsheet,
  xlsx: FileSpreadsheet,
  csv: FileSpreadsheet,
  tsv: FileSpreadsheet,
  numbers: FileSpreadsheet,
  ods: FileSpreadsheet,
  ppt: Presentation,
  pptx: Presentation,
  key: Presentation,
  odp: Presentation,
  zip: FileArchive,
  rar: FileArchive,
  "7z": FileArchive,
  tar: FileArchive,
  gz: FileArchive,
  tgz: FileArchive,
  bz2: FileArchive,
  js: FileCode,
  ts: FileCode,
  tsx: FileCode,
  jsx: FileCode,
  json: FileCode,
  py: FileCode,
  rs: FileCode,
  go: FileCode,
  java: FileCode,
  kt: FileCode,
  swift: FileCode,
  c: FileCode,
  cpp: FileCode,
  h: FileCode,
  css: FileCode,
  html: FileCode,
  xml: FileCode,
  yaml: FileCode,
  yml: FileCode,
  sh: FileCode,
  png: FileImage,
  jpg: FileImage,
  jpeg: FileImage,
  gif: FileImage,
  webp: FileImage,
  heic: FileImage,
  svg: FileImage,
  avif: FileImage,
  bmp: FileImage,
};

/** 파일 종류에 맞는 lucide 아이콘. 종류(영상·소리·PDF)가 확장자보다 우선한다 */
export function attachmentIcon(name: string, mime?: string | null): LucideIcon {
  const kind = attachmentKind(name, mime);
  if (kind === "video") return FileVideoCamera;
  if (kind === "audio") return FileMusic;
  if (kind === "pdf") return FileText;
  return BY_EXT[extensionOf(name)] ?? File;
}
