import { msg } from "@/lib/i18n";
import { common, createLowlight } from "lowlight";

/**
 * 코드 블록 언어 (ED-CodeBlock, DATA-04 내보내기가 함께 쓴다).
 * 언어를 정하지 않은 블록(`language: null`)은 "자동 감지" — 쓰는 대로 lowlight가 언어를 추측한다.
 */
export const lowlight = createLowlight(common);

/** 선택 목록에 보일 이름. lowlight `common`의 37개 언어 중 자주 쓰는 순서로 둔다. */
export const CODE_LANGUAGES: { value: string; label: string }[] = [
  {
    value: "plaintext",
    get label() {
      return msg().features.codeLanguage.plain;
    },
  },
  { value: "typescript", label: "TypeScript" },
  { value: "javascript", label: "JavaScript" },
  { value: "json", label: "JSON" },
  { value: "bash", label: "Bash" },
  {
    value: "shell",
    get label() {
      return msg().features.codeLanguage.shell;
    },
  },
  { value: "python", label: "Python" },
  { value: "rust", label: "Rust" },
  { value: "go", label: "Go" },
  { value: "java", label: "Java" },
  { value: "kotlin", label: "Kotlin" },
  { value: "swift", label: "Swift" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "csharp", label: "C#" },
  { value: "objectivec", label: "Objective-C" },
  { value: "php", label: "PHP" },
  { value: "ruby", label: "Ruby" },
  { value: "perl", label: "Perl" },
  { value: "lua", label: "Lua" },
  { value: "r", label: "R" },
  { value: "sql", label: "SQL" },
  { value: "graphql", label: "GraphQL" },
  { value: "xml", label: "HTML · XML" },
  { value: "css", label: "CSS" },
  { value: "scss", label: "SCSS" },
  { value: "less", label: "Less" },
  { value: "markdown", label: "Markdown" },
  { value: "yaml", label: "YAML" },
  { value: "ini", label: "INI · TOML" },
  { value: "diff", label: "Diff" },
  { value: "makefile", label: "Makefile" },
  { value: "arduino", label: "Arduino" },
  { value: "vbnet", label: "VB.NET" },
  { value: "wasm", label: "WebAssembly" },
  { value: "python-repl", label: "Python REPL" },
  {
    value: "php-template",
    get label() {
      return msg().features.codeLanguage.phpTemplate;
    },
  },
];

/** ```ts 처럼 줄임말로 만든 블록을 목록의 이름으로 맞춘다 */
const LANGUAGE_ALIASES: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  sh: "bash",
  zsh: "bash",
  console: "shell",
  py: "python",
  rs: "rust",
  golang: "go",
  kt: "kotlin",
  "c++": "cpp",
  cs: "csharp",
  rb: "ruby",
  html: "xml",
  svg: "xml",
  yml: "yaml",
  toml: "ini",
  md: "markdown",
  text: "plaintext",
  txt: "plaintext",
};

/** 자동 감지 상태(저장 값은 null) */
export const AUTO_LANGUAGE = "auto";

/** 저장된 값 → 목록 이름. 비어 있으면 자동 감지, 모르는 언어는 일반 텍스트 */
export function normalizeLanguage(lang: string | null | undefined): string {
  if (!lang || lang === AUTO_LANGUAGE) return AUTO_LANGUAGE;
  const key = lang.toLowerCase();
  const name = LANGUAGE_ALIASES[key] ?? key;
  return CODE_LANGUAGES.some((l) => l.value === name) ? name : "plaintext";
}

/**
 * 저장 값 → 저장할 값. 자동 감지(빈 값·`auto`)는 null, 나머지는 목록 이름으로 바꾼다.
 * 문서를 읽을 때(불러오기·파싱) 미리 적용해, 여는 중에 언어 이름을 고치는 트랜잭션이 생기지 않게 한다 (SYS-11).
 */
export function storedLanguage(lang: unknown): string | null {
  if (typeof lang !== "string" || !lang) return null;
  const name = normalizeLanguage(lang);
  return name === AUTO_LANGUAGE ? null : name;
}

type DocNode = { type?: string; attrs?: Record<string, unknown>; content?: DocNode[] };

/**
 * 문서 JSON의 코드 블록 언어를 저장 형식으로 바꾼다. 바뀔 것이 없으면 같은 객체를 돌려준다.
 * 입력 객체는 고치지 않는다.
 */
export function normalizeDocCodeLanguages<T extends DocNode>(node: T): T {
  let content = node.content;
  if (content) {
    const next = content.map((child) => normalizeDocCodeLanguages(child));
    if (next.some((child, i) => child !== content![i])) content = next;
  }
  if (node.type === "codeBlock" && node.attrs && "language" in node.attrs) {
    const language = storedLanguage(node.attrs.language);
    if (language !== node.attrs.language)
      return { ...node, content, attrs: { ...node.attrs, language } };
  }
  return content === node.content ? node : { ...node, content };
}

/** 이 정도 관련도보다 낮으면 "모르겠다"로 본다 — 짧은 글이 엉뚱한 언어로 잡히는 것을 막는다 */
const MIN_RELEVANCE = 5;

/** 글을 보고 목록에 있는 언어를 추측한다. 모르면 undefined */
export function detectLanguage(code: string): string | undefined {
  if (!code.trim()) return undefined;
  const { data } = lowlight.highlightAuto(code);
  const name = data?.language;
  if (!name || (data?.relevance ?? 0) < MIN_RELEVANCE) return undefined;
  return CODE_LANGUAGES.some((l) => l.value === name) ? name : undefined;
}

export const languageLabel = (value: string) =>
  CODE_LANGUAGES.find((l) => l.value === value)?.label ?? value;
