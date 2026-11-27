//! Markdown ↔ Tiptap JSON 변환 (MCP 서버, DATA-12).
//!
//! 앱의 TS 변환(`features/export/markdown.ts`, 붙여넣기 `markdown-paste.ts`)과 같은 노드 이름을 쓴다.
//! 다루는 것: 제목, 문단(줄바꿈은 hardBreak, 붙여넣기의 `breaks: true`와 같다), 글머리·번호·할 일 목록(중첩 포함),
//! 인용, 코드 블록(언어), 구분선, 굵게·기울임·취소선·인라인 코드·링크.
//! 다루지 않는 것(글로 옮기면 손실): 표(행 단위 텍스트로 남는다), 그림(링크 텍스트로 남는다), 접기·열·수식·멘션·
//! 콜아웃 만들기(읽기에서는 안쪽 글만 살린다), HTML 태그, 참조 링크, 줄 끝 두 칸 줄바꿈.

use serde_json::{Value, json};

/// Markdown 한 덩어리 → `{ "type": "doc", "content": [...] }`
pub fn markdown_to_doc(md: &str) -> Value {
    let normalized = md
        .replace("\r\n", "\n")
        .replace('\r', "\n")
        .replace('\t', "    ");
    let lines: Vec<&str> = normalized.split('\n').collect();
    json!({ "type": "doc", "content": parse_blocks(&lines) })
}

/// Tiptap 문서 → Markdown (읽기 도구·리소스용)
pub fn doc_to_markdown(doc: &Value) -> String {
    let body = render_blocks(children(doc), "\n\n");
    if body.is_empty() {
        body
    } else {
        format!("{body}\n")
    }
}

/// 검색용 평문: 글자 노드를 이어 붙이고 블록 끝마다 줄바꿈
pub fn doc_text(doc: &Value) -> String {
    let mut out = String::new();
    collect_text(doc, &mut out);
    out
}

// ---------------------------------------------------------------------------
// Markdown → Tiptap (블록)
// ---------------------------------------------------------------------------

fn indent_of(line: &str) -> usize {
    line.bytes().take_while(|b| *b == b' ').count()
}

/// 목록 한 줄의 표지 (`- `, `* `, `+ `, `1. `, `2) `)
struct Marker<'a> {
    indent: usize,
    ordered: bool,
    number: u64,
    /// 내용이 시작하는 열. 이어 붙는 줄은 이 열까지 들여쓰기를 걷어 낸다
    content_col: usize,
    rest: &'a str,
}

fn list_marker(line: &str) -> Option<Marker<'_>> {
    let indent = indent_of(line);
    let body = &line[indent..];
    let bytes = body.as_bytes();
    let (ordered, number, token_len) = if matches!(bytes.first(), Some(b'-' | b'*' | b'+')) {
        (false, 0, 1)
    } else {
        let digits = bytes.iter().take_while(|b| b.is_ascii_digit()).count();
        if (1..=9).contains(&digits) && matches!(bytes.get(digits), Some(b'.' | b')')) {
            (true, body[..digits].parse().unwrap_or(1), digits + 1)
        } else {
            return None;
        }
    };
    let after = &body[token_len..];
    if !after.is_empty() && !after.starts_with(' ') {
        return None;
    }
    let rest = after.trim_start_matches(' ');
    let spaces = after.len() - rest.len();
    Some(Marker {
        indent,
        ordered,
        number,
        content_col: indent + token_len + spaces.max(1),
        rest,
    })
}

fn is_hr(line: &str) -> bool {
    if indent_of(line) > 3 {
        return false;
    }
    let t: String = line.chars().filter(|c| !c.is_whitespace()).collect();
    t.len() >= 3
        && ["-", "*", "_"]
            .iter()
            .any(|m| t.chars().all(|c| c.to_string() == *m))
}

/// `# 제목` → (단계, 본문). 닫는 `#`는 뗀다
fn heading(line: &str) -> Option<(u64, &str)> {
    if indent_of(line) > 3 {
        return None;
    }
    let t = line.trim_start_matches(' ');
    let level = t.bytes().take_while(|b| *b == b'#').count();
    if !(1..=6).contains(&level) {
        return None;
    }
    let after = &t[level..];
    if !after.is_empty() && !after.starts_with(' ') {
        return None;
    }
    let mut text = after.trim();
    let stripped = text.trim_end_matches('#');
    if stripped.is_empty() || stripped.ends_with(' ') {
        text = stripped.trim_end();
    }
    Some((level as u64, text))
}

/// 여는 울타리 → (문자, 길이, 언어 문자열)
fn fence_open(line: &str) -> Option<(u8, usize, String)> {
    if indent_of(line) > 3 {
        return None;
    }
    let t = line.trim_start_matches(' ');
    let ch = *t.as_bytes().first()?;
    if ch != b'`' && ch != b'~' {
        return None;
    }
    let len = t.bytes().take_while(|b| *b == ch).count();
    if len < 3 {
        return None;
    }
    let info = t[len..].trim();
    if ch == b'`' && info.contains('`') {
        return None;
    }
    Some((ch, len, info.to_string()))
}

fn is_fence_close(line: &str, ch: u8, len: usize) -> bool {
    if indent_of(line) > 3 {
        return false;
    }
    let t = line.trim();
    t.len() >= len && t.bytes().all(|b| b == ch)
}

/// 인용 한 줄 → 「>」를 뗀 나머지
fn quote_line(line: &str) -> Option<&str> {
    if indent_of(line) > 3 {
        return None;
    }
    let rest = line.trim_start_matches(' ').strip_prefix('>')?;
    Some(rest.strip_prefix(' ').unwrap_or(rest))
}

fn starts_block(line: &str) -> bool {
    line.trim().is_empty()
        || fence_open(line).is_some()
        || heading(line).is_some()
        || is_hr(line)
        || quote_line(line).is_some()
        || list_marker(line).is_some()
        || details_open(line)
        || line.trim() == COLUMNS_OPEN
        || line.trim() == "$$"
}

/// `[ ] 할 일` / `[x] 끝남` → (체크 여부, 나머지)
fn task_box(s: &str) -> Option<(bool, &str)> {
    let checked = match s.get(..3)? {
        "[ ]" => false,
        "[x]" | "[X]" => true,
        _ => return None,
    };
    let rest = &s[3..];
    (rest.is_empty() || rest.starts_with(' ')).then(|| (checked, rest.trim_start_matches(' ')))
}

fn parse_blocks(lines: &[&str]) -> Vec<Value> {
    let mut out = Vec::new();
    let mut i = 0;
    while i < lines.len() {
        let line = lines[i];
        if line.trim().is_empty() {
            i += 1;
        } else if let Some((ch, len, info)) = fence_open(line) {
            let mut code = Vec::new();
            i += 1;
            while i < lines.len() && !is_fence_close(lines[i], ch, len) {
                code.push(lines[i]);
                i += 1;
            }
            i += 1; // 닫는 울타리 (없으면 끝까지)
            out.push(code_block(&info, &code));
        } else if details_open(line) {
            let end = matching_close(lines, i, details_open, is_details_close);
            out.push(details_node(&lines[i..end.min(lines.len())]));
            i = end + 1;
        } else if line.trim() == COLUMNS_OPEN {
            let end = matching_close(
                lines,
                i,
                |l| l.trim() == COLUMNS_OPEN,
                |l| l.trim() == COLUMNS_CLOSE,
            );
            out.push(columns_node(&lines[i + 1..end.min(lines.len())]));
            i = end + 1;
        } else if line.trim() == "$$" {
            let end = (i + 1..lines.len())
                .find(|&j| lines[j].trim() == "$$")
                .unwrap_or(lines.len());
            let latex = lines[i + 1..end].join("\n");
            out.push(json!({ "type": "blockMath", "attrs": { "latex": latex } }));
            i = end + 1;
        } else if is_table_row(line) && lines.get(i + 1).is_some_and(|l| is_table_sep(l)) {
            let end = (i..lines.len())
                .find(|&j| !is_table_row(lines[j]))
                .unwrap_or(lines.len());
            out.push(table_node(&lines[i..end]));
            i = end;
        } else if let Some((level, text)) = heading(line) {
            let mut node = json!({ "type": "heading", "attrs": { "level": level } });
            let inline = inline_nodes(text);
            if !inline.is_empty() {
                node["content"] = Value::Array(inline);
            }
            out.push(node);
            i += 1;
        } else if is_hr(line) {
            out.push(json!({ "type": "horizontalRule" }));
            i += 1;
        } else if quote_line(line).is_some() {
            let mut inner = Vec::new();
            while i < lines.len() {
                match quote_line(lines[i]) {
                    Some(rest) => inner.push(rest),
                    None => break,
                }
                i += 1;
            }
            out.push(callout_or_quote(&inner));
        } else if list_marker(line).is_some() {
            let (nodes, next) = parse_list(lines, i);
            out.extend(nodes);
            i = next;
        } else {
            let mut para = vec![line.trim()];
            i += 1;
            while i < lines.len() && !lines[i].trim().is_empty() && !starts_block(lines[i]) {
                para.push(lines[i].trim());
                i += 1;
            }
            out.push(paragraph(&para.join("\n")));
        }
    }
    out
}

/// 블록 내용 — 비었으면 빈 문단 하나 (Tiptap의 목록·인용은 블록이 하나 이상 있어야 한다)
fn non_empty_blocks(lines: &[&str]) -> Vec<Value> {
    let mut blocks = parse_blocks(lines);
    if blocks.is_empty() {
        blocks.push(json!({ "type": "paragraph" }));
    }
    blocks
}

fn paragraph(text: &str) -> Value {
    let mut node = json!({ "type": "paragraph" });
    let inline = inline_nodes(text);
    if !inline.is_empty() {
        node["content"] = Value::Array(inline);
    }
    node
}

/// 코드 블록 언어 줄임말 → 목록 이름 (모르는 이름은 그대로 둔다)
fn canonical_language(lang: &str) -> String {
    let name = match lang {
        "ts" | "tsx" => "typescript",
        "js" | "jsx" | "mjs" => "javascript",
        "sh" | "zsh" => "bash",
        "console" => "shell",
        "py" => "python",
        "rs" => "rust",
        "golang" => "go",
        "kt" => "kotlin",
        "c++" => "cpp",
        "cs" => "csharp",
        "rb" => "ruby",
        "html" | "svg" => "xml",
        "yml" => "yaml",
        "toml" => "ini",
        "md" => "markdown",
        "text" | "txt" => "plaintext",
        other => other,
    };
    name.to_string()
}

fn code_block(info: &str, lines: &[&str]) -> Value {
    // 줄임말(`ts`)은 목록 이름으로 저장한다 — src/lib/code-language.ts의 LANGUAGE_ALIASES와 같은 표
    let language = info
        .split_whitespace()
        .next()
        .map(|l| canonical_language(&l.to_ascii_lowercase()));
    let mut node = json!({ "type": "codeBlock", "attrs": { "language": language } });
    let text = lines.join("\n");
    if !text.is_empty() {
        node["content"] = json!([{ "type": "text", "text": text }]);
    }
    node
}

/// 목록 전체 (같은 들여쓰기·같은 종류의 표지가 이어지는 동안). 돌려주는 값은 (노드들, 다음 줄 번호).
/// 글머리 목록은 할 일 항목과 보통 항목이 섞이면 연속된 덩어리마다 목록을 나눈다 (Tiptap의 taskList는 할 일만 담는다)
fn parse_list(lines: &[&str], start: usize) -> (Vec<Value>, usize) {
    let first = list_marker(lines[start]).expect("parse_list는 목록 표지 줄에서만 부른다");
    let base = first.indent;
    let ordered = first.ordered;
    let start_number = first.number;

    // 항목마다 (본문 줄들, 할 일 여부, 체크 여부)
    let mut items: Vec<(Vec<String>, bool, bool)> = Vec::new();
    let mut i = start;
    while i < lines.len() {
        let Some(m) = list_marker(lines[i]).filter(|m| m.indent == base && m.ordered == ordered)
        else {
            break;
        };
        let mut body = vec![m.rest.to_string()];
        // 할 일 표시는 글머리 목록에서만 본다
        let task = if ordered { None } else { task_box(m.rest) };
        if let Some((_, rest)) = task {
            body[0] = rest.to_string();
        }
        i += 1;
        while i < lines.len() {
            let l = lines[i];
            if l.trim().is_empty() {
                let next = lines[i..].iter().find(|x| !x.trim().is_empty());
                let continues = next.is_some_and(|n| {
                    indent_of(n) > base
                        || list_marker(n).is_some_and(|k| k.indent == base && k.ordered == ordered)
                });
                if !continues {
                    break;
                }
                body.push(String::new());
            } else if indent_of(l) > base {
                body.push(l[indent_of(l).min(m.content_col)..].to_string());
            } else {
                break;
            }
            i += 1;
        }
        while body.last().is_some_and(|s| s.trim().is_empty()) {
            body.pop();
        }
        items.push((
            body,
            task.is_some(),
            task.is_some_and(|(checked, _)| checked),
        ));
    }

    let content_of = |body: &Vec<String>| -> Vec<Value> {
        let refs: Vec<&str> = body.iter().map(String::as_str).collect();
        non_empty_blocks(&refs)
    };

    // 덩어리 나누기: 번호 목록은 한 덩어리, 글머리 목록은 할 일 여부가 바뀔 때마다 나눈다
    let mut groups: Vec<Vec<&(Vec<String>, bool, bool)>> = Vec::new();
    for item in &items {
        let split = match groups.last().and_then(|g| g.last()) {
            Some(prev) => !ordered && prev.1 != item.1,
            None => true,
        };
        if split {
            groups.push(Vec::new());
        }
        groups.last_mut().expect("방금 넣었다").push(item);
    }

    let nodes = groups
        .iter()
        .map(|group| {
            if !ordered && group[0].1 {
                let children = group
                    .iter()
                    .map(|(body, _, checked)| {
                        json!({ "type": "taskItem", "attrs": { "checked": checked }, "content": content_of(body) })
                    })
                    .collect::<Vec<_>>();
                json!({ "type": "taskList", "content": children })
            } else {
                let children = group
                    .iter()
                    .map(|(body, _, _)| json!({ "type": "listItem", "content": content_of(body) }))
                    .collect::<Vec<_>>();
                if ordered {
                    json!({ "type": "orderedList", "attrs": { "start": start_number }, "content": children })
                } else {
                    json!({ "type": "bulletList", "content": children })
                }
            }
        })
        .collect();
    (nodes, i)
}

// ---------------------------------------------------------------------------
// 인라인 (글자 노드와 marks)
// ---------------------------------------------------------------------------

const ESCAPABLE: &str = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~";

fn inline_nodes(text: &str) -> Vec<Value> {
    let chars: Vec<char> = text.chars().collect();
    let mut out = Vec::new();
    parse_inline(&chars, &[], &mut out);
    out
}

fn mark(kind: &str) -> Value {
    json!({ "type": kind })
}

fn link_mark(href: &str) -> Value {
    json!({ "type": "link", "attrs": { "href": href } })
}

fn push_text(out: &mut Vec<Value>, text: &str, marks: &[Value]) {
    if text.is_empty() {
        return;
    }
    let mut node = json!({ "type": "text", "text": text });
    if !marks.is_empty() {
        node["marks"] = Value::Array(marks.to_vec());
    }
    out.push(node);
}

fn flush(buf: &mut String, marks: &[Value], out: &mut Vec<Value>) {
    let text = std::mem::take(buf);
    push_text(out, &text, marks);
}

fn run_len(chars: &[char], at: usize, c: char) -> usize {
    chars[at..].iter().take_while(|x| **x == c).count()
}

/// 같은 길이의 백틱 묶음 위치 찾기 (인라인 코드 닫기)
fn find_code_close(chars: &[char], from: usize, run: usize) -> Option<usize> {
    let mut j = from;
    while j < chars.len() {
        if chars[j] == '`' {
            let r = run_len(chars, j, '`');
            if r == run {
                return Some(j);
            }
            j += r;
        } else {
            j += 1;
        }
    }
    None
}

fn find_pair(chars: &[char], from: usize, pat: &[char]) -> Option<usize> {
    if chars.len() < pat.len() {
        return None;
    }
    (from..=chars.len() - pat.len()).find(|&j| chars[j..j + pat.len()] == *pat)
}

/// 기울임 닫는 `*`/`_` 찾기. 앞이 공백이 아니고, `_`는 낱말 안에서 쓰이지 않을 때만
fn find_single(chars: &[char], from: usize, c: char) -> Option<usize> {
    (from + 1..chars.len()).find(|&j| {
        chars[j] == c
            && !chars[j - 1].is_whitespace()
            && chars.get(j + 1) != Some(&c)
            && (c == '*' || !chars.get(j + 1).is_some_and(|n| n.is_alphanumeric()))
    })
}

/// `[label](url)` → (라벨 끝 위치, 주소, 닫는 괄호 다음 위치). `start`는 여는 `[`
fn parse_link(chars: &[char], start: usize) -> Option<(usize, String, usize)> {
    let mut depth = 0usize;
    let mut label_end = None;
    let mut j = start;
    while j < chars.len() {
        match chars[j] {
            '\\' => j += 1,
            '[' => depth += 1,
            ']' => {
                depth -= 1;
                if depth == 0 {
                    label_end = Some(j);
                    break;
                }
            }
            _ => {}
        }
        j += 1;
    }
    let le = label_end?;
    if chars.get(le + 1) != Some(&'(') {
        return None;
    }
    let mut k = le + 2;
    let mut d = 0usize;
    let mut close = None;
    while k < chars.len() {
        match chars[k] {
            '(' => d += 1,
            ')' if d == 0 => {
                close = Some(k);
                break;
            }
            ')' => d -= 1,
            _ => {}
        }
        k += 1;
    }
    let cl = close?;
    let inner: String = chars[le + 2..cl].iter().collect();
    let url = inner
        .split_whitespace()
        .next()?
        .trim_matches(|c| c == '<' || c == '>');
    if url.is_empty() {
        return None;
    }
    Some((le, url.to_string(), cl + 1))
}

fn parse_inline(chars: &[char], marks: &[Value], out: &mut Vec<Value>) {
    let mut buf = String::new();
    let mut i = 0;
    while i < chars.len() {
        let c = chars[i];
        let next = chars.get(i + 1).copied();
        match c {
            '\\' if next.is_some_and(|n| ESCAPABLE.contains(n)) => {
                buf.push(next.unwrap_or(c));
                i += 2;
            }
            '\n' => {
                flush(&mut buf, marks, out);
                out.push(json!({ "type": "hardBreak" }));
                i += 1;
            }
            '`' => {
                let run = run_len(chars, i, '`');
                match find_code_close(chars, i + run, run) {
                    Some(close) => {
                        flush(&mut buf, marks, out);
                        let text: String = chars[i + run..close].iter().collect();
                        let mut m = marks.to_vec();
                        m.push(mark("code"));
                        push_text(out, &text, &m);
                        i = close + run;
                    }
                    None => {
                        buf.extend(std::iter::repeat_n('`', run));
                        i += run;
                    }
                }
            }
            '[' | '!' if c == '[' || next == Some('[') => {
                let start = if c == '!' { i + 1 } else { i };
                match parse_link(chars, start) {
                    Some((label_end, url, after)) => {
                        flush(&mut buf, marks, out);
                        let mut m = marks.to_vec();
                        m.push(link_mark(&url));
                        parse_inline(&chars[start + 1..label_end], &m, out);
                        i = after;
                    }
                    None => {
                        buf.push(c);
                        i += 1;
                    }
                }
            }
            '<' => {
                let end = chars[i..].iter().position(|x| *x == '>').map(|p| p + i);
                let inner: Option<String> = end.map(|e| chars[i + 1..e].iter().collect());
                match (end, inner) {
                    (Some(e), Some(url))
                        if (url.starts_with("http://") || url.starts_with("https://"))
                            && !url.contains(' ') =>
                    {
                        flush(&mut buf, marks, out);
                        let mut m = marks.to_vec();
                        m.push(link_mark(&url));
                        push_text(out, &url, &m);
                        i = e + 1;
                    }
                    _ => {
                        buf.push(c);
                        i += 1;
                    }
                }
            }
            '@' => match date_chip_at(chars, i) {
                Some(date) => {
                    flush(&mut buf, marks, out);
                    out.push(json!({ "type": "dateChip", "attrs": { "date": date } }));
                    i += 11;
                }
                None => {
                    buf.push(c);
                    i += 1;
                }
            },
            '$' if next.is_some_and(|n| n != '$' && !n.is_whitespace()) => {
                match find_single(chars, i, '$') {
                    Some(close) if !chars[close - 1].is_whitespace() => {
                        flush(&mut buf, marks, out);
                        let latex: String = chars[i + 1..close].iter().collect();
                        out.push(json!({ "type": "inlineMath", "attrs": { "latex": latex } }));
                        i = close + 1;
                    }
                    _ => {
                        buf.push(c);
                        i += 1;
                    }
                }
            }
            '~' if next == Some('~') => match find_pair(chars, i + 2, &['~', '~']) {
                Some(close) if close > i + 2 => {
                    flush(&mut buf, marks, out);
                    let mut m = marks.to_vec();
                    m.push(mark("strike"));
                    parse_inline(&chars[i + 2..close], &m, out);
                    i = close + 2;
                }
                _ => {
                    buf.push_str("~~");
                    i += 2;
                }
            },
            '*' | '_' if next == Some(c) => match find_pair(chars, i + 2, &[c, c]) {
                Some(close)
                    if close > i + 2 && (c == '*' || i == 0 || !chars[i - 1].is_alphanumeric()) =>
                {
                    flush(&mut buf, marks, out);
                    let mut m = marks.to_vec();
                    m.push(mark("bold"));
                    parse_inline(&chars[i + 2..close], &m, out);
                    i = close + 2;
                }
                _ => {
                    buf.push(c);
                    buf.push(c);
                    i += 2;
                }
            },
            '*' | '_'
                if next.is_some_and(|n| !n.is_whitespace())
                    && (c == '*' || i == 0 || !chars[i - 1].is_alphanumeric()) =>
            {
                match find_single(chars, i, c) {
                    Some(close) => {
                        flush(&mut buf, marks, out);
                        let mut m = marks.to_vec();
                        m.push(mark("italic"));
                        parse_inline(&chars[i + 1..close], &m, out);
                        i = close + 1;
                    }
                    None => {
                        buf.push(c);
                        i += 1;
                    }
                }
            }
            _ => {
                buf.push(c);
                i += 1;
            }
        }
    }
    flush(&mut buf, marks, out);
}

// ---------------------------------------------------------------------------
// Tiptap → Markdown
// ---------------------------------------------------------------------------

fn children(node: &Value) -> &[Value] {
    node.get("content")
        .and_then(Value::as_array)
        .map(Vec::as_slice)
        .unwrap_or(&[])
}

fn str_attr<'a>(node: &'a Value, key: &str) -> Option<&'a str> {
    node.get("attrs")?.get(key)?.as_str()
}

fn node_type(node: &Value) -> &str {
    node.get("type").and_then(Value::as_str).unwrap_or("")
}

fn render_blocks(nodes: &[Value], sep: &str) -> String {
    nodes
        .iter()
        .map(render_block)
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join(sep)
}

fn render_block(node: &Value) -> String {
    match node_type(node) {
        "paragraph" => inline(children(node)),
        "heading" => {
            let level = node
                .get("attrs")
                .and_then(|a| a.get("level"))
                .and_then(Value::as_u64)
                .unwrap_or(1)
                .clamp(1, 6) as usize;
            format!("{} {}", "#".repeat(level), inline(children(node)))
                .trim_end()
                .to_string()
        }
        "bulletList" => children(node)
            .iter()
            .map(|li| list_item(li, "- "))
            .collect::<Vec<_>>()
            .join("\n"),
        "orderedList" => {
            let start = node
                .get("attrs")
                .and_then(|a| a.get("start"))
                .and_then(Value::as_u64)
                .unwrap_or(1);
            children(node)
                .iter()
                .enumerate()
                .map(|(k, li)| list_item(li, &format!("{}. ", start + k as u64)))
                .collect::<Vec<_>>()
                .join("\n")
        }
        "taskList" | "taskItem" => {
            let items: Vec<&Value> = if node_type(node) == "taskItem" {
                vec![node]
            } else {
                children(node).iter().collect()
            };
            items
                .iter()
                .map(|item| {
                    let checked = item
                        .get("attrs")
                        .and_then(|a| a.get("checked"))
                        .and_then(Value::as_bool)
                        .unwrap_or(false);
                    list_item(item, if checked { "- [x] " } else { "- [ ] " })
                })
                .collect::<Vec<_>>()
                .join("\n")
        }
        "blockquote" => prefix_lines(&render_blocks(children(node), "\n\n"), "> ", "> "),
        "callout" => {
            let emoji = str_attr(node, "emoji").unwrap_or("💡");
            let kind = callout_type(str_attr(node, "color").unwrap_or("blue"));
            prefix_lines(
                &render_blocks(children(node), "\n\n"),
                &format!("> [!{kind}] {emoji} "),
                "> ",
            )
        }
        "codeBlock" => {
            let code = plain_text(node);
            let longest = longest_backtick_run(&code);
            let fence = "`".repeat((longest + 1).max(3));
            let lang = match str_attr(node, "language") {
                Some(l) if l != "plaintext" => l,
                _ => "",
            };
            format!("{fence}{lang}\n{code}\n{fence}")
        }
        "horizontalRule" => "---".to_string(),
        "image" => {
            let src = str_attr(node, "src")
                .or_else(|| {
                    str_attr(node, "remote")
                        .filter(|r| r.starts_with("http://") || r.starts_with("https://"))
                })
                .unwrap_or("");
            format!("![{}]({src})", escape_text(&plain_text(node)))
        }
        "table" => {
            let rows: Vec<Vec<String>> = children(node)
                .iter()
                .map(|row| {
                    children(row)
                        .iter()
                        .map(table_cell_text)
                        .collect::<Vec<String>>()
                })
                .collect();
            let Some(header) = rows.first() else {
                return String::new();
            };
            let cols = rows.iter().map(Vec::len).max().unwrap_or(0);
            let line = |cells: &[String]| {
                let padded: Vec<String> = (0..cols)
                    .map(|i| cells.get(i).cloned().unwrap_or_default())
                    .collect();
                format!("| {} |", padded.join(" | "))
            };
            let sep = vec!["---".to_string(); cols];
            let mut out = vec![line(header), line(&sep)];
            out.extend(rows[1..].iter().map(|r| line(r)));
            out.join("\n")
        }
        "details" => {
            let summary = children(node)
                .iter()
                .find(|c| node_type(c) == "detailsSummary");
            let content = children(node)
                .iter()
                .find(|c| node_type(c) == "detailsContent");
            details_block(
                is_open(node, false),
                &summary.map(|s| inline(children(s))).unwrap_or_default(),
                &content
                    .map(|c| render_blocks(children(c), "\n\n"))
                    .unwrap_or_default(),
            )
        }
        "toggleHeading" => {
            let kids = children(node);
            let summary = match kids.first() {
                Some(h) if node_type(h) == "heading" => {
                    let level = h
                        .get("attrs")
                        .and_then(|a| a.get("level"))
                        .and_then(Value::as_u64)
                        .unwrap_or(1)
                        .clamp(1, 3);
                    format!("<h{level}>{}</h{level}>", inline(children(h)))
                }
                _ => String::new(),
            };
            let rest = if summary.is_empty() {
                kids
            } else {
                kids.get(1..).unwrap_or(&[])
            };
            details_block(is_open(node, true), &summary, &render_blocks(rest, "\n\n"))
        }
        "columns" => {
            let mut parts = vec!["<!-- cetusnote:columns -->".to_string()];
            for col in children(node) {
                let width = col
                    .get("attrs")
                    .and_then(|a| a.get("width"))
                    .and_then(Value::as_f64)
                    .filter(|w| *w > 0.0)
                    .unwrap_or(1.0);
                let mut col_parts = vec![format!("<!-- cetusnote:column width={width} -->")];
                let body = render_blocks(children(col), "\n\n");
                if !body.is_empty() {
                    col_parts.push(body);
                }
                col_parts.push("<!-- /cetusnote:column -->".to_string());
                parts.push(col_parts.join("\n\n"));
            }
            parts.push("<!-- /cetusnote:columns -->".to_string());
            parts.join("\n\n")
        }
        "blockMath" => format!("$$\n{}\n$$", str_attr(node, "latex").unwrap_or("")),
        "attachment" => {
            let name = str_attr(node, "name")
                .filter(|n| !n.is_empty())
                .unwrap_or("첨부");
            format!(
                "[{}]({})",
                escape_text(name),
                str_attr(node, "path").unwrap_or("")
            )
        }
        "subpage" => {
            let id = str_attr(node, "pageId").unwrap_or("");
            let title = str_attr(node, "title")
                .filter(|t| !t.is_empty())
                .unwrap_or("하위 페이지");
            format!("[{}](cetusnote://page/{id})", escape_text(title))
        }
        // 경로 표시는 문서 밖(페이지 경로)을 몰라서 빈 블록이 된다 — 앱의 복사와 같다
        "breadcrumb" => String::new(),
        "hardBreak" => "\n".to_string(),
        _ => {
            if children(node).is_empty() {
                str_attr(node, "label")
                    .or_else(|| str_attr(node, "title"))
                    .unwrap_or("")
                    .to_string()
            } else {
                inline_or_blocks(node)
            }
        }
    }
}

/// 자식이 글자 노드뿐이면 인라인, 블록이 있으면 블록으로
fn inline_or_blocks(node: &Value) -> String {
    let kids = children(node);
    let all_inline = kids.iter().all(|k| {
        matches!(
            node_type(k),
            "text" | "hardBreak" | "pageMention" | "emoji" | "dateChip" | "inlineMath"
        )
    });
    if all_inline {
        inline(kids)
    } else {
        render_blocks(kids, "\n\n")
    }
}

fn list_item(node: &Value, marker: &str) -> String {
    let body = render_blocks(children(node), "\n");
    if body.is_empty() {
        return marker.trim_end().to_string();
    }
    let pad = " ".repeat(marker.len());
    body.lines()
        .enumerate()
        .map(|(k, line)| match (k, line.is_empty()) {
            (0, _) => format!("{marker}{line}"),
            (_, true) => String::new(),
            _ => format!("{pad}{line}"),
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn prefix_lines(text: &str, first: &str, rest: &str) -> String {
    text.lines()
        .enumerate()
        .map(|(k, line)| {
            let p = if k == 0 { first } else { rest };
            if line.is_empty() {
                p.trim_end().to_string()
            } else {
                format!("{p}{line}")
            }
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn inline(nodes: &[Value]) -> String {
    nodes
        .iter()
        .map(|node| match node_type(node) {
            "text" => marked_text(node),
            "hardBreak" => "\n".to_string(),
            "pageMention" => {
                let id = str_attr(node, "id").unwrap_or("");
                let label = str_attr(node, "label")
                    .filter(|l| !l.is_empty())
                    .unwrap_or("제목 없음");
                format!("[{}](cetusnote://page/{id})", escape_text(label))
            }
            "dateChip" => str_attr(node, "date")
                .map(|d| format!("@{d}"))
                .unwrap_or_default(),
            "inlineMath" => format!("${}$", str_attr(node, "latex").unwrap_or("")),
            _ if !children(node).is_empty() => inline(children(node)),
            _ => str_attr(node, "label")
                .or_else(|| str_attr(node, "title"))
                .unwrap_or("")
                .to_string(),
        })
        .collect()
}

fn marked_text(node: &Value) -> String {
    let text = node.get("text").and_then(Value::as_str).unwrap_or("");
    let marks: &[Value] = node
        .get("marks")
        .and_then(Value::as_array)
        .map(Vec::as_slice)
        .unwrap_or(&[]);
    let has = |kind: &str| marks.iter().any(|m| node_type(m) == kind);
    let mut s = if has("code") {
        code_span(text)
    } else {
        escape_text(text)
    };
    if has("bold") {
        s = format!("**{s}**");
    }
    if has("italic") {
        s = format!("*{s}*");
    }
    if has("strike") {
        s = format!("~~{s}~~");
    }
    if let Some(href) = marks
        .iter()
        .find(|m| node_type(m) == "link")
        .and_then(|m| m.get("attrs")?.get("href")?.as_str())
    {
        s = format!("[{s}]({href})");
    }
    s
}

fn code_span(text: &str) -> String {
    let fence = "`".repeat(longest_backtick_run(text) + 1);
    let pad = if text.starts_with('`') || text.ends_with('`') {
        " "
    } else {
        ""
    };
    format!("{fence}{pad}{text}{pad}{fence}")
}

fn escape_text(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    for c in text.chars() {
        if "\\*_`[]~".contains(c) {
            out.push('\\');
        }
        out.push(c);
    }
    out
}

fn longest_backtick_run(text: &str) -> usize {
    let (mut best, mut cur) = (0, 0);
    for c in text.chars() {
        cur = if c == '`' { cur + 1 } else { 0 };
        best = best.max(cur);
    }
    best
}

/// 노드 아래 글자만 이어 붙인다 (코드 블록, 그림 설명)
fn plain_text(node: &Value) -> String {
    let mut out = String::new();
    fn walk(n: &Value, out: &mut String) {
        if let Some(t) = n.get("text").and_then(Value::as_str) {
            out.push_str(t);
        }
        for c in children(n) {
            walk(c, out);
        }
    }
    walk(node, &mut out);
    out
}

fn collect_text(node: &Value, out: &mut String) {
    if let Some(t) = node.get("text").and_then(Value::as_str) {
        out.push_str(t);
        return;
    }
    for c in children(node) {
        collect_text(c, out);
    }
    if !children(node).is_empty() {
        out.push('\n');
    }
}

// ── 앱 내보내기와 같은 확장 형식 (토글·열·콜아웃·수식·날짜 칩·표) ──

const COLUMNS_OPEN: &str = "<!-- cetusnote:columns -->";
const COLUMNS_CLOSE: &str = "<!-- /cetusnote:columns -->";
const COLUMN_CLOSE: &str = "<!-- /cetusnote:column -->";

/// 콜아웃 색 → 종류 이름. 표준이 없는 색은 `CETUS-<색>` (lib/callout-type.ts와 같은 규칙)
fn callout_type(color: &str) -> String {
    match color {
        "blue" => "NOTE".to_string(),
        "green" => "TIP".to_string(),
        "yellow" => "WARNING".to_string(),
        "red" => "CAUTION".to_string(),
        "purple" => "IMPORTANT".to_string(),
        other => format!("CETUS-{other}"),
    }
}

/// 콜아웃 종류 이름 → 색. 모르는 종류는 파란색 (가져오기 규칙)
fn callout_color(kind: &str) -> String {
    if let Some(color) = kind.strip_prefix("CETUS-") {
        return color.to_ascii_lowercase();
    }
    let name: &str = match kind.to_ascii_uppercase().as_str() {
        "TIP" | "HINT" | "SUCCESS" | "CHECK" | "DONE" => "green",
        "WARNING" | "QUESTION" => "yellow",
        "CAUTION" | "DANGER" | "ERROR" | "FAILURE" => "red",
        "IMPORTANT" => "purple",
        _ => "blue",
    };
    name.to_string()
}

fn is_open(node: &Value, default: bool) -> bool {
    node.get("attrs")
        .and_then(|a| a.get("open"))
        .and_then(Value::as_bool)
        .unwrap_or(default)
}

fn details_block(open: bool, summary: &str, body: &str) -> String {
    let mut lines = vec![
        if open {
            "<details open>".to_string()
        } else {
            "<details>".to_string()
        },
        format!("<summary>{summary}</summary>"),
    ];
    if !body.is_empty() {
        lines.push(String::new());
        lines.push(body.to_string());
        lines.push(String::new());
    }
    lines.push("</details>".to_string());
    lines.join("\n")
}

/// 표 칸: 문단은 `<br>`로 잇고, `|`는 이스케이프한다
fn table_cell_text(cell: &Value) -> String {
    children(cell)
        .iter()
        .map(|p| inline(children(p)))
        .collect::<Vec<_>>()
        .join("<br>")
        .replace('|', "\\|")
        .replace('\n', " ")
        .trim()
        .to_string()
}

/// `@YYYY-MM-DD` 날짜 칩 (앞뒤가 글자가 아닐 때만)
fn date_chip_at(chars: &[char], i: usize) -> Option<String> {
    let s: String = chars.get(i + 1..i + 11)?.iter().collect();
    let bytes = s.as_bytes();
    let shape_ok = bytes.iter().enumerate().all(|(k, &ch)| {
        if k == 4 || k == 7 {
            ch == b'-'
        } else {
            ch.is_ascii_digit()
        }
    });
    if !shape_ok {
        return None;
    }
    let month: u32 = s[5..7].parse().ok()?;
    let day: u32 = s[8..10].parse().ok()?;
    if !(1..=12).contains(&month) || !(1..=31).contains(&day) {
        return None;
    }
    if i > 0 && (chars[i - 1].is_alphanumeric() || chars[i - 1] == '@' || chars[i - 1] == '_') {
        return None;
    }
    if chars
        .get(i + 11)
        .is_some_and(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
    {
        return None;
    }
    Some(s)
}

/// `<details>` 여닫기 짝 찾기 (중첩 허용). 짝이 없으면 줄 수를 돌려준다
fn matching_close(
    lines: &[&str],
    start: usize,
    open: impl Fn(&str) -> bool,
    close: impl Fn(&str) -> bool,
) -> usize {
    let mut depth = 0usize;
    for (j, line) in lines.iter().enumerate().skip(start) {
        if open(line) {
            depth += 1;
        } else if close(line) {
            depth = depth.saturating_sub(1);
            if depth == 0 {
                return j;
            }
        }
    }
    lines.len()
}

fn details_open(line: &str) -> bool {
    let t = line.trim();
    t == "<details>" || t.starts_with("<details ")
}

fn is_details_close(line: &str) -> bool {
    line.trim() == "</details>"
}

fn summary_text(line: &str) -> Option<&str> {
    line.trim()
        .strip_prefix("<summary>")?
        .strip_suffix("</summary>")
}

/// `<h2>제목</h2>` 요약 → (단계, 제목)
fn heading_summary(summary: &str) -> Option<(u64, &str)> {
    let rest = summary.strip_prefix("<h")?;
    let level = rest.chars().next()?.to_digit(10)?;
    if !(1..=3).contains(&level) {
        return None;
    }
    let body = rest
        .get(1..)?
        .strip_prefix('>')?
        .strip_suffix(format!("</h{level}>").as_str())?;
    Some((u64::from(level), body))
}

fn trim_blank<'a, 'b>(lines: &'b [&'a str]) -> &'b [&'a str] {
    let start = lines
        .iter()
        .position(|l| !l.trim().is_empty())
        .unwrap_or(lines.len());
    let end = lines
        .iter()
        .rposition(|l| !l.trim().is_empty())
        .map_or(start, |e| e + 1);
    &lines[start..end.max(start)]
}

/// `<details>` 블록 한 덩이 → 토글(details) 또는 제목 토글(toggleHeading)
fn details_node(block: &[&str]) -> Value {
    let open = block[0].contains(" open");
    let inner_end = if block.len() > 1 && is_details_close(block[block.len() - 1]) {
        block.len() - 1
    } else {
        block.len()
    };
    let inner = &block[1..inner_end];
    let mut summary = "";
    let mut rest: &[&str] = inner;
    if let Some(first) = inner.iter().position(|l| !l.trim().is_empty()) {
        if let Some(text) = summary_text(inner[first]) {
            summary = text;
            rest = &inner[first + 1..];
        }
    }
    let body = trim_blank(rest);
    if let Some((level, text)) = heading_summary(summary) {
        let mut heading = json!({ "type": "heading", "attrs": { "level": level } });
        let inl = inline_nodes(text);
        if !inl.is_empty() {
            heading["content"] = Value::Array(inl);
        }
        let mut kids = vec![heading];
        kids.extend(parse_blocks(body));
        return json!({ "type": "toggleHeading", "attrs": { "open": open }, "content": kids });
    }
    let mut summary_node = json!({ "type": "detailsSummary" });
    let inl = inline_nodes(summary);
    if !inl.is_empty() {
        summary_node["content"] = Value::Array(inl);
    }
    json!({
        "type": "details",
        "attrs": { "open": open },
        "content": [
            summary_node,
            { "type": "detailsContent", "content": non_empty_blocks(body) }
        ]
    })
}

/// `<!-- cetusnote:column width=N -->` 표지 → 열 너비 (표지가 아니면 None)
fn column_width(line: &str) -> Option<f64> {
    let inner = line
        .trim()
        .strip_prefix("<!-- cetusnote:column")?
        .strip_suffix("-->")?
        .trim();
    if inner.is_empty() {
        return Some(1.0);
    }
    inner.strip_prefix("width=")?.parse::<f64>().ok()
}

fn columns_node(lines: &[&str]) -> Value {
    let mut cols = Vec::new();
    let mut i = 0;
    while i < lines.len() {
        match column_width(lines[i]) {
            Some(width) => {
                let end = matching_close(
                    lines,
                    i,
                    |l| column_width(l).is_some(),
                    |l| l.trim() == COLUMN_CLOSE,
                );
                let width_val = if width.fract() == 0.0 {
                    json!(width as u64)
                } else {
                    json!(width)
                };
                let body = non_empty_blocks(&lines[i + 1..end.min(lines.len())]);
                cols.push(
                    json!({ "type": "column", "attrs": { "width": width_val }, "content": body }),
                );
                i = end + 1;
            }
            None => i += 1,
        }
    }
    json!({ "type": "columns", "content": cols })
}

/// `[!TYPE] 이모지 …` 머리 → (종류, 나머지)
fn callout_head(line: &str) -> Option<(&str, &str)> {
    let rest = line.trim_start().strip_prefix("[!")?;
    let end = rest.find(']')?;
    let kind = &rest[..end];
    let first = kind.chars().next()?;
    if !first.is_ascii_alphabetic()
        || !kind
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return None;
    }
    Some((kind, rest[end + 1..].trim_start()))
}

/// 머리 글의 첫 낱말이 이모지면 떼어낸다 (없으면 기본 💡)
fn split_emoji(text: &str) -> (String, &str) {
    let (head, tail) = text.split_once(' ').unwrap_or((text, ""));
    let is_emoji =
        !head.is_empty() && !head.chars().any(|c| c.is_ascii_alphanumeric()) && !head.is_ascii();
    if is_emoji {
        (head.to_string(), tail.trim_start())
    } else {
        ("💡".to_string(), text)
    }
}

fn callout_or_quote(inner: &[&str]) -> Value {
    let Some((kind, rest)) = inner.first().and_then(|l| callout_head(l)) else {
        return json!({ "type": "blockquote", "content": non_empty_blocks(inner) });
    };
    let (emoji, text) = split_emoji(rest);
    let mut body: Vec<&str> = Vec::new();
    if !text.is_empty() {
        body.push(text);
    }
    body.extend_from_slice(&inner[1..]);
    json!({
        "type": "callout",
        "attrs": { "color": callout_color(kind), "emoji": emoji },
        "content": non_empty_blocks(&body)
    })
}

fn is_table_row(line: &str) -> bool {
    line.trim().starts_with('|')
}

fn is_table_sep(line: &str) -> bool {
    let t = line.trim();
    t.starts_with('|') && t.contains('-') && t.chars().all(|c| matches!(c, '|' | '-' | ':' | ' '))
}

/// 표 한 줄 → 칸 글자. `\|`는 `|` 글자로 본다
fn split_row(line: &str) -> Vec<String> {
    let t = line.trim();
    let t = t.strip_prefix('|').unwrap_or(t);
    let t = t.strip_suffix('|').unwrap_or(t);
    let mut cells = Vec::new();
    let mut cur = String::new();
    let mut chars = t.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\\' && chars.peek() == Some(&'|') {
            cur.push('|');
            chars.next();
        } else if c == '|' {
            cells.push(cur.trim().to_string());
            cur.clear();
        } else {
            cur.push(c);
        }
    }
    cells.push(cur.trim().to_string());
    cells
}

/// 표 블록 (첫 줄은 머리, 둘째 줄은 구분선). `<br>`는 칸 안의 문단 나눔
fn table_node(lines: &[&str]) -> Value {
    let mut rows = Vec::new();
    for (k, line) in lines.iter().enumerate() {
        if k == 1 {
            continue;
        }
        let cell_type = if k == 0 { "tableHeader" } else { "tableCell" };
        let cells: Vec<Value> = split_row(line)
            .iter()
            .map(|cell| {
                let paragraphs: Vec<Value> = cell
                    .split("<br>")
                    .map(|piece| paragraph(piece.trim()))
                    .collect();
                json!({ "type": cell_type, "content": paragraphs })
            })
            .collect();
        rows.push(json!({ "type": "tableRow", "content": cells }));
    }
    json!({ "type": "table", "content": rows })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn text_of(doc: &Value) -> String {
        doc_text(doc)
    }

    #[test]
    fn headings_and_paragraphs() {
        let doc = markdown_to_doc("# 제목 ##\n\n## 둘째\n\n첫 줄\n둘째 줄");
        let c = children(&doc);
        assert_eq!(c[0]["type"], "heading");
        assert_eq!(c[0]["attrs"]["level"], 1);
        assert_eq!(c[0]["content"][0]["text"], "제목");
        assert_eq!(c[1]["attrs"]["level"], 2);
        assert_eq!(c[2]["type"], "paragraph");
        // 줄바꿈은 hardBreak (붙여넣기의 breaks: true와 같다)
        assert_eq!(c[2]["content"][1]["type"], "hardBreak");
    }

    #[test]
    fn bullet_ordered_and_nested_lists() {
        let doc = markdown_to_doc("- 하나\n  - 안쪽\n- 둘\n\n3. 셋\n4. 넷");
        let c = children(&doc);
        assert_eq!(c[0]["type"], "bulletList");
        let items = children(&c[0]);
        assert_eq!(items.len(), 2);
        // 첫 항목은 문단 + 중첩 목록
        assert_eq!(children(&items[0])[1]["type"], "bulletList");
        assert_eq!(c[1]["type"], "orderedList");
        assert_eq!(c[1]["attrs"]["start"], 3);
        assert_eq!(children(&c[1]).len(), 2);
    }

    #[test]
    fn task_list_checked_state() {
        let doc = markdown_to_doc("- [ ] 할 일\n- [x] 끝\n- [X] 끝2");
        let c = children(&doc);
        assert_eq!(c[0]["type"], "taskList");
        let items = children(&c[0]);
        assert_eq!(items[0]["type"], "taskItem");
        assert_eq!(items[0]["attrs"]["checked"], false);
        assert_eq!(items[1]["attrs"]["checked"], true);
        assert_eq!(items[2]["attrs"]["checked"], true);
        let text = text_of(&c[0]);
        assert!(text.contains("할 일") && text.contains("끝") && text.contains("끝2"));
    }

    #[test]
    fn mixed_bullet_list_splits_into_task_and_plain_groups() {
        let doc = markdown_to_doc("- [ ] 할 일\n- [x] 끝\n- 보통 항목\n- 또 보통");
        let c = children(&doc);
        assert_eq!(c.len(), 2, "할 일 덩어리와 보통 덩어리");
        assert_eq!(c[0]["type"], "taskList");
        assert_eq!(c[0]["content"].as_array().unwrap().len(), 2);
        assert_eq!(c[1]["type"], "bulletList");
        assert_eq!(c[1]["content"].as_array().unwrap().len(), 2);
    }

    #[test]
    fn code_block_maps_language_abbreviations_to_list_names() {
        let doc = markdown_to_doc(
            "```TS\nlet a = 1;\n```\n\n```yml\na: 1\n```\n\n```brainfuck\n+\n```\n",
        );
        assert_eq!(doc["content"][0]["attrs"]["language"], "typescript");
        assert_eq!(doc["content"][1]["attrs"]["language"], "yaml");
        assert_eq!(doc["content"][2]["attrs"]["language"], "brainfuck");
    }

    #[test]
    fn code_block_keeps_language_and_text_verbatim() {
        let doc = markdown_to_doc("```rust\nfn main() {}\n  - not a list\n```\n뒤");
        let c = children(&doc);
        assert_eq!(c[0]["type"], "codeBlock");
        assert_eq!(c[0]["attrs"]["language"], "rust");
        assert_eq!(c[0]["content"][0]["text"], "fn main() {}\n  - not a list");
        assert_eq!(c[1]["type"], "paragraph");
    }

    #[test]
    fn quote_and_rule() {
        let doc = markdown_to_doc("> 인용\n> 둘째\n\n---");
        let c = children(&doc);
        assert_eq!(c[0]["type"], "blockquote");
        assert_eq!(c[1]["type"], "horizontalRule");
    }

    #[test]
    fn inline_marks_and_links() {
        let doc = markdown_to_doc("**굵게** *기울임* ~~지움~~ `코드` [링크](https://example.com)");
        let c = children(&doc);
        let inl = children(&c[0]);
        assert_eq!(inl[0]["marks"][0]["type"], "bold");
        assert_eq!(inl[0]["text"], "굵게");
        assert_eq!(inl[2]["marks"][0]["type"], "italic");
        assert_eq!(inl[4]["marks"][0]["type"], "strike");
        assert_eq!(inl[6]["marks"][0]["type"], "code");
        let link = inl.last().unwrap();
        assert_eq!(link["text"], "링크");
        assert_eq!(link["marks"][0]["attrs"]["href"], "https://example.com");
    }

    #[test]
    fn escapes_and_snake_case_are_literal() {
        let doc = markdown_to_doc(r"snake_case_name 와 \*별\* [대괄호]");
        assert_eq!(text_of(&doc).trim(), "snake_case_name 와 *별* [대괄호]");
        let inl = children(&children(&doc)[0]);
        assert!(inl.iter().all(|n| n.get("marks").is_none()));
    }

    #[test]
    fn unclosed_markers_stay_text() {
        let doc = markdown_to_doc("a * b **c");
        assert_eq!(text_of(&doc).trim(), "a * b **c");
    }

    #[test]
    fn doc_to_markdown_round_trips_common_blocks() {
        let src = "# 제목\n\n문단 **굵게** *기울* `x`\n\n- a\n- [ ] b\n\n1. 첫째\n2. 둘째\n\n> 인용\n\n```ts\nconst a = 1;\n```\n\n---";
        let doc = markdown_to_doc(src);
        let back = doc_to_markdown(&doc);
        let again = doc_to_markdown(&markdown_to_doc(&back));
        assert_eq!(back, again, "두 번째 변환에서 흔들리면 안 된다");
        assert!(back.contains("# 제목"));
        assert!(back.contains("**굵게**"));
        assert!(back.contains("- [ ] b"));
        assert!(back.contains("2. 둘째"));
        // 줄임말은 목록 이름으로 저장된다 (ts → typescript)
        assert!(back.contains("```typescript\nconst a = 1;\n```"));
    }

    #[test]
    fn export_escapes_text_that_would_otherwise_turn_into_markup() {
        let doc = json!({"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"*별* [x]"}]}]});
        let md = doc_to_markdown(&doc);
        assert_eq!(md, "\\*별\\* \\[x\\]\n");
        assert_eq!(text_of(&markdown_to_doc(&md)).trim(), "*별* [x]");
    }

    #[test]
    fn code_fence_grows_when_code_contains_backticks() {
        let doc = json!({"type":"doc","content":[{"type":"codeBlock","attrs":{"language":null},"content":[{"type":"text","text":"a ``` b"}]}]});
        let md = doc_to_markdown(&doc);
        assert!(md.starts_with("````\n"));
    }

    fn render(node: Value) -> String {
        render_block(&node)
    }

    #[test]
    fn details_toggle_round_trips_closed_and_open() {
        let md = "<details>\n<summary>요약</summary>\n\n본문\n\n</details>\n";
        let doc = markdown_to_doc(md);
        assert_eq!(doc["content"][0]["type"], "details");
        assert_eq!(doc["content"][0]["content"][0]["type"], "detailsSummary");
        assert_eq!(doc["content"][0]["content"][1]["type"], "detailsContent");
        assert_eq!(doc["content"][0]["attrs"]["open"], false);
        assert_eq!(doc_to_markdown(&doc), md);
        let open = "<details open>\n<summary>열림</summary>\n\n내용\n\n</details>\n";
        assert_eq!(doc_to_markdown(&markdown_to_doc(open)), open);
    }

    #[test]
    fn toggle_heading_round_trips_as_heading_summary() {
        let md = "<details open>\n<summary><h2>제목</h2></summary>\n\n본문\n\n</details>\n";
        let doc = markdown_to_doc(md);
        assert_eq!(doc["content"][0]["type"], "toggleHeading");
        assert_eq!(doc["content"][0]["content"][0]["attrs"]["level"], 2);
        assert_eq!(doc_to_markdown(&doc), md);
    }

    #[test]
    fn columns_round_trip_with_widths() {
        let md = "<!-- cetusnote:columns -->\n\n<!-- cetusnote:column width=2 -->\n\n왼쪽\n\n<!-- /cetusnote:column -->\n\n<!-- cetusnote:column width=1 -->\n\n오른쪽\n\n<!-- /cetusnote:column -->\n\n<!-- /cetusnote:columns -->\n";
        let doc = markdown_to_doc(md);
        assert_eq!(doc["content"][0]["type"], "columns");
        assert_eq!(doc["content"][0]["content"][0]["attrs"]["width"], 2);
        assert_eq!(doc["content"][0]["content"][1]["attrs"]["width"], 1);
        assert_eq!(doc_to_markdown(&doc), md);
    }

    #[test]
    fn callout_maps_color_to_standard_or_custom_type() {
        let blue = json!({ "type": "callout", "attrs": { "color": "blue", "emoji": "💡" },
            "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "주의" }] }] });
        assert_eq!(render(blue), "> [!NOTE] 💡 주의");
        let pink = json!({ "type": "callout", "attrs": { "color": "pink", "emoji": "🌸" },
            "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "꽃" }] }] });
        assert_eq!(render(pink), "> [!CETUS-pink] 🌸 꽃");
        let doc = markdown_to_doc("> [!WARNING] 🔥 조심\n> 물을 마세요\n");
        assert_eq!(doc["content"][0]["type"], "callout");
        assert_eq!(doc["content"][0]["attrs"]["color"], "yellow");
        assert_eq!(doc["content"][0]["attrs"]["emoji"], "🔥");
        assert_eq!(
            doc_to_markdown(&doc),
            "> [!WARNING] 🔥 조심\n> 물을 마세요\n"
        );
        // 종류 표지가 없는 인용은 그대로 인용이다
        assert_eq!(
            markdown_to_doc("> 그냥 글\n")["content"][0]["type"],
            "blockquote"
        );
    }

    #[test]
    fn table_round_trips_header_separator_and_pipes() {
        let md = "| 이름 | 값 |\n| --- | --- |\n| a \\| b | 1 |\n";
        let doc = markdown_to_doc(md);
        assert_eq!(doc["content"][0]["type"], "table");
        assert_eq!(
            doc["content"][0]["content"][0]["content"][0]["type"],
            "tableHeader"
        );
        assert_eq!(
            doc["content"][0]["content"][1]["content"][0]["type"],
            "tableCell"
        );
        assert_eq!(doc_to_markdown(&doc), md);
    }

    #[test]
    fn math_block_and_inline_round_trip() {
        let md = "$$\nE = mc^2\n$$\n\n본문 $x^2$ 끝\n";
        let doc = markdown_to_doc(md);
        assert_eq!(doc["content"][0]["type"], "blockMath");
        assert_eq!(doc["content"][0]["attrs"]["latex"], "E = mc^2");
        assert_eq!(doc["content"][1]["content"][1]["type"], "inlineMath");
        assert_eq!(doc_to_markdown(&doc), md);
    }

    #[test]
    fn date_chip_round_trips_and_rejects_invalid_dates() {
        let doc = markdown_to_doc("마감 @2026-11-30 입니다\n");
        assert_eq!(doc["content"][0]["content"][1]["type"], "dateChip");
        assert_eq!(
            doc["content"][0]["content"][1]["attrs"]["date"],
            "2026-11-30"
        );
        assert_eq!(doc_to_markdown(&doc), "마감 @2026-11-30 입니다\n");
        let bad = markdown_to_doc("@2026-13-01\n");
        assert_eq!(bad["content"][0]["content"][0]["type"], "text");
    }

    #[test]
    fn page_mention_subpage_attachment_breadcrumb_render_like_export() {
        let mention = json!({ "type": "paragraph", "content": [
            { "type": "pageMention", "attrs": { "id": "p1", "label": "목표" } }] });
        assert_eq!(render(mention), "[목표](cetusnote://page/p1)");
        assert_eq!(
            render(json!({ "type": "subpage", "attrs": { "pageId": "p2" } })),
            "[하위 페이지](cetusnote://page/p2)"
        );
        assert_eq!(
            render(
                json!({ "type": "attachment", "attrs": { "name": "a.pdf", "path": "assets/a.pdf" } })
            ),
            "[a.pdf](assets/a.pdf)"
        );
        assert_eq!(render(json!({ "type": "breadcrumb" })), "");
    }

    #[test]
    fn empty_input_gives_empty_doc() {
        let doc = markdown_to_doc("   \n\n");
        assert_eq!(children(&doc).len(), 0);
        assert_eq!(doc_to_markdown(&doc), "");
    }
}
