import { common, createLowlight } from "lowlight";

/**
 * 코드 블록 언어 (ED-CodeBlock, DATA-04 내보내기가 함께 쓴다).
 * 언어를 정하지 않은 블록(`language: null`)은 "자동 감지" — 쓰는 대로 lowlight가 언어를 추측한다.
 */
export const lowlight = createLowlight(common);

/** 선택 목록에 보일 이름. lowlight `common`의 37개 언어 중 자주 쓰는 순서로 둔다. */
export const CODE_LANGUAGES: { value: string; label: string }[] = [
  { value: "plaintext", label: "일반 텍스트" },
  { value: "typescript", label: "TypeScript" },
  { value: "javascript", label: "JavaScript" },
  { value: "json", label: "JSON" },
  { value: "bash", label: "Bash" },
  { value: "shell", label: "셸 세션" },
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
  { value: "php-template", label: "PHP 템플릿" },
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
