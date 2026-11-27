//! MCP 도구가 쓰는 페이지 작업 (DATA-12). 저장은 모두 `storage::Workspace`를 거친다
//! (원자적 쓰기, id 검사, 버전 기록). 여기서는 목록·검색·변경 규칙만 다룬다.
//! 오류는 모델이 읽을 한국어 문장(`Err(String)`)으로 돌려주고, 도구 결과의 `isError`가 된다.

use crate::mcp::markdown::{Refs, doc_text, doc_to_markdown_with, markdown_to_doc_with};
use crate::storage::{LoadError, StorageError, Workspace, is_valid_id};
use rmcp::schemars::{self, JsonSchema};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

/// 페이지 스키마 번호. 앱의 `PAGE_SCHEMA_VERSION`(src/lib/storage/schema.ts)과 맞춘다.
/// 앱이 더 높은 번호를 쓰면 앱이 읽을 때 마이그레이션한다 (낮은 번호로 써도 안전하다).
pub const PAGE_SCHEMA_VERSION: u64 = 7;

/// 한 번에 가져올 수 있는 목록 항목 상한
pub const LIST_MAX: usize = 200;
/// 검색 결과 상한
pub const SEARCH_MAX: usize = 50;
/// 입력 Markdown 크기 상한 (바이트)
pub const MARKDOWN_MAX_BYTES: usize = 2 * 1024 * 1024;
const TITLE_MAX_CHARS: usize = 200;

pub type Res<T> = Result<T, String>;

fn storage_err(e: StorageError) -> String {
    e.message
}

// ---------------------------------------------------------------------------
// id · 시각 (앱과 같은 형식: ULID, UTC ISO 8601 밀리초)
// ---------------------------------------------------------------------------

const CROCKFORD: &[u8; 32] = b"0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/// 새 페이지 id (ULID: 48비트 밀리초 + 80비트 난수, Crockford base32 26자)
pub fn new_page_id() -> Res<String> {
    let ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis() as u128;
    let mut rnd = [0u8; 10];
    getrandom::fill(&mut rnd).map_err(|e| format!("난수를 만들지 못했어요: {e}"))?;
    let rand80 = rnd.iter().fold(0u128, |acc, b| (acc << 8) | *b as u128);
    let value = ((ms & 0xFFFF_FFFF_FFFF) << 80) | rand80;
    let id: String = (0..26)
        .map(|k| {
            let shift = 5 * (25 - k);
            CROCKFORD[((value >> shift) & 31) as usize] as char
        })
        .collect();
    Ok(id)
}

/// 지금 시각 (UTC, `2026-11-26T12:00:00.000Z`)
pub fn now_iso() -> String {
    let d = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let secs = d.as_secs() as i64;
    let ms = d.subsec_millis();
    let days = secs.div_euclid(86_400);
    let rem = secs.rem_euclid(86_400);
    let (y, m, day) = civil_from_days(days);
    format!(
        "{y:04}-{m:02}-{day:02}T{:02}:{:02}:{:02}.{ms:03}Z",
        rem / 3600,
        (rem % 3600) / 60,
        rem % 60
    )
}

/// 1970-01-01 기준 날짜 수 → (년, 월, 일). Howard Hinnant의 알고리즘
fn civil_from_days(z: i64) -> (i64, u32, u32) {
    let z = z + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    let y = yoe + era * 400 + i64::from(m <= 2);
    (y, m, d)
}

// ---------------------------------------------------------------------------
// 페이지 목록 (찾기·트리 공통)
// ---------------------------------------------------------------------------

/// 목록·검색에 필요한 페이지 정보 (본문 제외)
#[derive(Clone)]
pub struct Entry {
    pub id: String,
    pub kind: String,
    pub title: String,
    pub parent_id: Option<String>,
    pub tags: Vec<String>,
    pub status: Option<String>,
    pub due: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub trashed: bool,
    pub template: bool,
    /// 검색용 소문자 제목·본문. 파일을 읽을 때 한 번만 만든다(SYS-10)
    pub title_lc: String,
    pub body_lc: String,
}

/// 읽지 못한 파일 목록과 함께 돌려주는 워크스페이스 스냅샷
pub struct Snapshot {
    pub entries: HashMap<String, Arc<Entry>>,
    /// 정렬된 형제 순서 (트리 순서): 부모 키 → 항목별 순위
    pub sibling_rank: HashMap<String, HashMap<String, usize>>,
    pub load_errors: Vec<LoadError>,
}

fn str_field(v: &Value, key: &str) -> String {
    v.get(key).and_then(Value::as_str).unwrap_or("").to_string()
}

pub(super) fn entry_of(page: Value) -> Option<Entry> {
    let id = page.get("id")?.as_str()?.to_string();
    let props = page.get("props").cloned().unwrap_or(Value::Null);
    let tags = props
        .get("tags")
        .and_then(Value::as_array)
        .map(|a| {
            a.iter()
                .filter_map(Value::as_str)
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default();
    Some(Entry {
        kind: page
            .get("kind")
            .and_then(Value::as_str)
            .unwrap_or("page")
            .to_string(),
        title: str_field(&page, "title"),
        parent_id: page
            .get("parentId")
            .and_then(Value::as_str)
            .map(str::to_string),
        tags,
        status: props
            .get("status")
            .and_then(Value::as_str)
            .map(str::to_string),
        due: props.get("due").and_then(Value::as_str).map(str::to_string),
        created_at: str_field(&page, "createdAt"),
        updated_at: str_field(&page, "updatedAt"),
        trashed: page.get("trashedAt").is_some_and(|t| !t.is_null()),
        template: page.get("template").is_some_and(|t| !t.is_null()),
        title_lc: str_field(&page, "title").to_lowercase(),
        body_lc: doc_text(page.get("content").unwrap_or(&Value::Null)).to_lowercase(),
        id,
    })
}

pub fn snapshot(ws: &Workspace) -> Res<Snapshot> {
    // 안 바뀐 페이지는 캐시에서 꺼낸다 (SYS-10)
    let loaded = super::cache::load(ws).map_err(storage_err)?;
    // 트리 순서: workspace.json의 order[부모 | "root"]가 먼저, 나머지는 폴더 먼저·만든 순 (앱과 같다)
    let order = ws
        .read_meta()
        .map_err(storage_err)?
        .and_then(|m| m.get("order").cloned())
        .unwrap_or(Value::Null);
    let mut sibling_rank: HashMap<String, HashMap<String, usize>> = HashMap::new();
    if let Some(map) = order.as_object() {
        for (key, ids) in map {
            let ranks = ids
                .as_array()
                .map(|a| {
                    a.iter()
                        .filter_map(Value::as_str)
                        .enumerate()
                        .map(|(i, id)| (id.to_string(), i))
                        .collect()
                })
                .unwrap_or_default();
            sibling_rank.insert(key.clone(), ranks);
        }
    }
    Ok(Snapshot {
        entries: loaded.entries.clone(),
        sibling_rank,
        load_errors: loaded
            .errors
            .iter()
            .map(|e| LoadError {
                file: e.file.clone(),
                message: e.message.clone(),
            })
            .collect(),
    })
}

/// 자식 목록의 키 중 루트 (부모 없음). 앱의 workspace.json order 키 "root"와 대응한다
const ROOT: &str = "root";

impl Snapshot {
    /// 숨김 여부: 템플릿, 휴지통(옵션이 꺼졌을 때), 또는 그 위 조상 중 하나가 그런 경우 (앱의 트리와 같다)
    fn hidden(&self, id: &str, include_trashed: bool) -> bool {
        let mut seen = HashSet::new();
        let mut cur = id.to_string();
        loop {
            if !seen.insert(cur.clone()) {
                return false; // 순환은 루트로 본다
            }
            let Some(e) = self.entries.get(&cur) else {
                return true;
            };
            if e.template || (!include_trashed && e.trashed) {
                return true;
            }
            match e.parent_id.as_deref() {
                Some(p) if self.entries.contains_key(p) => cur = p.to_string(),
                _ => return false,
            }
        }
    }

    /// 실제로 붙는 부모. 부모가 없거나, 순환이거나, 컬렉션 아래에 문서가 아닌 것이면 루트(None)
    fn effective_parent(&self, id: &str) -> Option<String> {
        let e = self.entries.get(id)?;
        let p = e.parent_id.clone()?;
        let parent = self.entries.get(&p)?;
        if parent.kind == "collection" && e.kind != "page" {
            return None;
        }
        let mut visited = HashSet::new();
        let mut cur = p.clone();
        loop {
            if cur == id {
                return None; // 순환
            }
            if !visited.insert(cur.clone()) {
                break; // 순환이지만 이 항목은 안에 없다
            }
            match self.entries.get(&cur).and_then(|x| x.parent_id.clone()) {
                Some(next) => cur = next,
                None => break,
            }
        }
        Some(p)
    }

    /// 조상 chain (원래 부모부터). 이동할 때 순환을 막는 데 쓴다
    fn ancestors(&self, id: &str) -> Vec<String> {
        let mut out = Vec::new();
        let mut seen = HashSet::new();
        let mut cur = self.entries.get(id).and_then(|e| e.parent_id.clone());
        while let Some(p) = cur {
            if !seen.insert(p.clone()) {
                break;
            }
            cur = self.entries.get(&p).and_then(|e| e.parent_id.clone());
            out.push(p);
        }
        out
    }

    /// 부모별 자식 목록 (한 번만 만든다). 정렬: 트리 순서 → 폴더 먼저 → 만든 순 → id
    fn index(&self, include_trashed: bool) -> HashMap<String, Vec<String>> {
        let mut map: HashMap<String, Vec<String>> = HashMap::new();
        for e in self.entries.values() {
            if self.hidden(&e.id, include_trashed) {
                continue;
            }
            let key = self
                .effective_parent(&e.id)
                .unwrap_or_else(|| ROOT.to_string());
            map.entry(key).or_default().push(e.id.clone());
        }
        for (key, kids) in map.iter_mut() {
            let ranks = self.sibling_rank.get(key.as_str());
            kids.sort_by(|a, b| {
                let ra = ranks.and_then(|r| r.get(a)).copied().unwrap_or(usize::MAX);
                let rb = ranks.and_then(|r| r.get(b)).copied().unwrap_or(usize::MAX);
                let (ea, eb) = (&self.entries[a], &self.entries[b]);
                ra.cmp(&rb)
                    .then((ea.kind != "folder").cmp(&(eb.kind != "folder")))
                    .then(ea.created_at.cmp(&eb.created_at))
                    .then(ea.id.cmp(&eb.id))
            });
        }
        map
    }

    /// 깊이 우선 순서로 (id, 깊이). `root`가 있으면 그 아래 후손만
    pub fn flatten(&self, root: Option<&str>, include_trashed: bool) -> Vec<(String, u32)> {
        let index = self.index(include_trashed);
        let mut out = Vec::new();
        let mut seen = HashSet::new();
        let start = root.unwrap_or(ROOT);
        let mut stack: Vec<(String, u32)> = index
            .get(start)
            .map(|kids| kids.iter().rev().map(|id| (id.clone(), 0)).collect())
            .unwrap_or_default();
        while let Some((id, depth)) = stack.pop() {
            if !seen.insert(id.clone()) {
                continue;
            }
            if let Some(kids) = index.get(&id) {
                for k in kids.iter().rev() {
                    stack.push((k.clone(), depth + 1));
                }
            }
            out.push((id, depth));
        }
        out
    }
}

// ---------------------------------------------------------------------------
// 도구 입력·출력 (JSON 스키마는 schemars가 만든다. 설명은 모델이 읽는다)
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct ListArgs {
    /// 이 페이지 아래의 모든 하위 페이지만 보여 준다. 생략하면 워크스페이스 전체
    pub parent_id: Option<String>,
    /// `flat`(기본): 깊이 우선 순서의 목록 · `tree`: 들여쓴 개요 글 + 항목의 depth
    pub format: Option<ListFormat>,
    /// 휴지통에 있는 페이지도 넣을지 (기본 false)
    pub include_trashed: Option<bool>,
    /// 한 번에 가져올 개수 (기본 50, 최대 200)
    pub limit: Option<usize>,
    /// 이전 응답의 nextCursor. 생략하면 처음부터
    pub cursor: Option<String>,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, JsonSchema, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ListFormat {
    Flat,
    Tree,
}

#[derive(Debug, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct PageSummary {
    pub id: String,
    pub title: String,
    /// page(문서) · folder(폴더) · collection(컬렉션)
    pub kind: String,
    pub parent_id: Option<String>,
    /// 최상위가 0. 같은 깊이의 항목은 같은 들여쓰기
    pub depth: u32,
    pub tags: Vec<String>,
    pub status: Option<String>,
    pub due: Option<String>,
    pub updated_at: String,
    pub trashed: bool,
}

#[derive(Debug, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListOut {
    pub items: Vec<PageSummary>,
    /// 조건에 맞는 전체 개수
    pub total: usize,
    /// 다음 페이지를 받을 커서. 마지막이면 null
    pub next_cursor: Option<String>,
    /// 파일이 깨져서 건너뛴 항목 수 (앱과 같은 규칙으로 읽지 못한 파일)
    pub skipped_files: usize,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct SearchArgs {
    /// 찾을 말. 공백으로 나누면 모든 낱말이 들어 있는 페이지를 찾는다 (대소문자 무시)
    pub query: String,
    /// 최대 개수 (기본 10, 최대 50)
    pub limit: Option<usize>,
}

#[derive(Debug, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    pub id: String,
    pub title: String,
    pub parent_id: Option<String>,
    /// 본문에서 찾은 곳 주변 문장 (제목에만 있으면 빈 문자열)
    pub snippet: String,
    pub score: u32,
    pub updated_at: String,
}

#[derive(Debug, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct SearchOut {
    pub results: Vec<SearchHit>,
    pub skipped_files: usize,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, JsonSchema, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ReadFormat {
    /// 본문을 Markdown으로 (기본)
    Markdown,
    /// 앱 저장 형식(Tiptap JSON) 그대로
    TiptapJson,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct ReadArgs {
    /// 페이지 id (ULID, 26자)
    pub page_id: String,
    /// `markdown`(기본) 또는 `tiptap_json`
    pub format: Option<ReadFormat>,
}

#[derive(Debug, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ReadOut {
    pub id: String,
    pub title: String,
    pub kind: String,
    pub parent_id: Option<String>,
    pub tags: Vec<String>,
    pub status: Option<String>,
    pub due: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub trashed: bool,
    /// 요청한 형식: markdown 또는 tiptap_json
    pub format: ReadFormat,
    /// format이 markdown일 때의 본문
    pub markdown: Option<String>,
    /// format이 tiptap_json일 때의 본문 (Tiptap 문서)
    pub content: Option<Value>,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct CreateArgs {
    /// 새 페이지 제목 (1–200자)
    pub title: String,
    /// 넣을 부모 페이지 id. 생략하면 최상위
    pub parent_id: Option<String>,
    /// 본문 Markdown. 제목, 목록, 할 일(- [ ]), 인용, 코드 블록, 굵게·기울임·링크를 살린다
    pub markdown: Option<String>,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct AppendArgs {
    /// 대상 페이지 id
    pub page_id: String,
    /// 본문 끝에 덧붙일 Markdown. 기존 내용은 그대로 둔다
    pub markdown: String,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct UpdateArgs {
    /// 대상 페이지 id
    pub page_id: String,
    /// 새 제목 (생략하면 그대로)
    pub title: Option<String>,
    /// 새 본문 Markdown. 기존 본문을 통째로 바꾼다 (바꾸기 전 버전 기록에 남는다). 생략하면 본문은 그대로
    pub markdown: Option<String>,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct MoveArgs {
    /// 옮길 페이지 id
    pub page_id: String,
    /// 새 부모 페이지 id. null 또는 생략하면 최상위로 옮긴다
    pub parent_id: Option<String>,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct TrashArgs {
    /// 휴지통으로 옮길 페이지 id. 앱의 휴지통에서 되살릴 수 있다 (영구 삭제는 하지 않는다)
    pub page_id: String,
}

#[derive(Debug, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct WriteOut {
    pub id: String,
    pub title: String,
    pub kind: String,
    pub parent_id: Option<String>,
    pub updated_at: String,
    pub trashed: bool,
    /// 실제로 바뀌었는지. 같은 내용이면 false (쓰기를 건너뛰었다)
    pub changed: bool,
    /// 바꾸기 전 버전을 버전 기록에 남겼는지
    pub history_saved: bool,
}

// ---------------------------------------------------------------------------
// 작업
// ---------------------------------------------------------------------------

/// 페이지 제목 (없는 페이지·잘못된 id는 None). 하위 페이지·멘션을 풀 때 쓴다
fn page_title(ws: &Workspace, id: &str) -> Option<String> {
    check_page_id(id).ok()?;
    let page = ws.read_page(id).ok()??;
    Some(
        page.get("title")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string(),
    )
}

fn check_page_id(id: &str) -> Res<()> {
    if is_valid_id(id) {
        Ok(())
    } else {
        Err(format!(
            "페이지 id 형식이 아니에요: {id:?}. list_pages나 search_pages로 올바른 id를 찾아 주세요"
        ))
    }
}

fn clean_title(title: &str) -> Res<String> {
    let t = title.trim();
    if t.is_empty() {
        return Err("제목이 비어 있어요. 1자 이상 적어 주세요".into());
    }
    if t.chars().count() > TITLE_MAX_CHARS {
        return Err(format!("제목은 {TITLE_MAX_CHARS}자 이하여야 해요"));
    }
    Ok(t.to_string())
}

fn check_markdown(md: &str) -> Res<()> {
    if md.len() > MARKDOWN_MAX_BYTES {
        return Err(format!(
            "본문이 너무 커요 ({}MB 이하로 나눠 주세요)",
            MARKDOWN_MAX_BYTES / 1024 / 1024
        ));
    }
    Ok(())
}

fn load_page(ws: &Workspace, id: &str) -> Res<Value> {
    check_page_id(id)?;
    let page = ws
        .read_page(id)
        .map_err(storage_err)?
        .ok_or_else(|| format!("페이지를 찾을 수 없어요: {id}. list_pages로 확인해 주세요"))?;
    Ok(page)
}

/// 쓰기 가능한 살아 있는 페이지 (휴지통·템플릿 아님)
fn load_live_page(ws: &Workspace, id: &str) -> Res<Value> {
    let page = load_page(ws, id)?;
    if page.get("trashedAt").is_some_and(|t| !t.is_null()) {
        return Err(format!(
            "휴지통에 있는 페이지예요: {id}. 먼저 앱의 휴지통에서 되살려 주세요"
        ));
    }
    if page.get("template").is_some_and(|t| !t.is_null()) {
        return Err("템플릿 페이지는 MCP로 바꿀 수 없어요".into());
    }
    Ok(page)
}

fn check_parent(ws: &Workspace, parent_id: &str, moving_kind: &str) -> Res<Value> {
    let parent =
        load_live_page(ws, parent_id).map_err(|e| format!("부모 페이지를 쓸 수 없어요: {e}"))?;
    let parent_kind = parent.get("kind").and_then(Value::as_str).unwrap_or("page");
    if parent_kind == "collection" && moving_kind != "page" {
        return Err("컬렉션 아래에는 문서만 둘 수 있어요".into());
    }
    Ok(parent)
}

/// 바꾸기 전에 버전 기록을 남기고 저장한다. 내용(updatedAt 제외)이 같으면 쓰지 않는다
fn save_changes(ws: &Workspace, before: &Value, after: Value) -> Res<WriteOutcome> {
    let strip = |v: &Value| {
        let mut v = v.clone();
        if let Some(obj) = v.as_object_mut() {
            obj.remove("updatedAt");
        }
        v
    };
    if strip(before) == strip(&after) {
        return Ok(WriteOutcome {
            page: after,
            changed: false,
            history_saved: false,
        });
    }
    ws.save_version(before).map_err(|e| {
        format!(
            "버전 기록을 남기지 못해 페이지를 바꾸지 않았어요: {}",
            e.message
        )
    })?;
    ws.write_page(&after).map_err(storage_err)?;
    super::cache::forget(ws);
    Ok(WriteOutcome {
        page: after,
        changed: true,
        history_saved: true,
    })
}

struct WriteOutcome {
    page: Value,
    changed: bool,
    history_saved: bool,
}

fn write_out(o: WriteOutcome) -> WriteOut {
    let e = entry_of(o.page).expect("저장한 페이지에는 id가 있다");
    WriteOut {
        id: e.id,
        title: e.title,
        kind: e.kind,
        parent_id: e.parent_id,
        updated_at: e.updated_at,
        trashed: e.trashed,
        changed: o.changed,
        history_saved: o.history_saved,
    }
}

pub fn list(ws: &Workspace, args: ListArgs) -> Res<ListOut> {
    let limit = args.limit.unwrap_or(50);
    if limit == 0 || limit > LIST_MAX {
        return Err(format!("limit은 1부터 {LIST_MAX}까지예요"));
    }
    let include_trashed = args.include_trashed.unwrap_or(false);
    let offset = match args.cursor.as_deref() {
        None => 0,
        Some(c) => c.parse::<usize>().map_err(|_| {
            "cursor가 올바르지 않아요. 이전 응답의 nextCursor를 그대로 넘겨 주세요".to_string()
        })?,
    };
    let snap = snapshot(ws)?;
    if let Some(p) = args.parent_id.as_deref() {
        check_page_id(p)?;
        if !snap.entries.contains_key(p) {
            return Err(format!("부모 페이지를 찾을 수 없어요: {p}"));
        }
    }
    let flat = snap.flatten(args.parent_id.as_deref(), include_trashed);
    let total = flat.len();
    let items = flat
        .iter()
        .skip(offset)
        .take(limit)
        .filter_map(|(id, depth)| snap.entries.get(id).map(|e| (e, *depth)))
        .map(|(e, depth)| PageSummary {
            id: e.id.clone(),
            title: e.title.clone(),
            kind: e.kind.clone(),
            parent_id: e.parent_id.clone(),
            depth,
            tags: e.tags.clone(),
            status: e.status.clone(),
            due: e.due.clone(),
            updated_at: e.updated_at.clone(),
            trashed: e.trashed,
        })
        .collect::<Vec<_>>();
    let next = offset + items.len();
    Ok(ListOut {
        items,
        total,
        next_cursor: (next < total).then(|| next.to_string()),
        skipped_files: snap.load_errors.len(),
    })
}

/// 들여쓴 개요 글 (format=tree일 때 본문 앞에 붙인다)
pub fn outline_text(items: &[PageSummary]) -> String {
    items
        .iter()
        .map(|i| {
            let mark = if i.trashed { " (휴지통)" } else { "" };
            format!(
                "{}- {} [{}]{mark}",
                "  ".repeat(i.depth as usize),
                i.title,
                i.id
            )
        })
        .collect::<Vec<_>>()
        .join("\n")
}

/// 평평한 목록 글 (format=flat): 들여쓰기 없이 한 줄에 하나
pub fn flat_text(items: &[PageSummary]) -> String {
    items
        .iter()
        .map(|i| {
            let mark = if i.trashed { " (휴지통)" } else { "" };
            format!("- {} [{}]{mark}", i.title, i.id)
        })
        .collect::<Vec<_>>()
        .join("\n")
}

pub fn search(ws: &Workspace, args: SearchArgs) -> Res<SearchOut> {
    let limit = args.limit.unwrap_or(10);
    if limit == 0 || limit > SEARCH_MAX {
        return Err(format!("limit은 1부터 {SEARCH_MAX}까지예요"));
    }
    let terms: Vec<String> = args
        .query
        .split_whitespace()
        .map(|t| t.to_lowercase())
        .collect();
    if terms.is_empty() {
        return Err("검색어가 비어 있어요".into());
    }
    let snap = snapshot(ws)?;
    let mut hits: Vec<(u32, SearchHit)> = Vec::new();
    for e in snap.entries.values() {
        if e.trashed || e.template {
            continue;
        }
        let title = e.title_lc.as_str();
        let body = e.body_lc.as_str();
        if !terms
            .iter()
            .all(|t| title.contains(t.as_str()) || body.contains(t.as_str()))
        {
            continue;
        }
        let title_hits: u32 = terms
            .iter()
            .map(|t| title.matches(t.as_str()).count() as u32)
            .sum();
        let body_hits: u32 = terms
            .iter()
            .map(|t| body.matches(t.as_str()).count() as u32)
            .sum();
        let score = title_hits * 5 + body_hits.min(50);
        let snippet = terms
            .iter()
            .find_map(|t| {
                body.find(t.as_str())
                    .map(|at| snippet_at(&body, at, t.len()))
            })
            .unwrap_or_default();
        hits.push((
            score,
            SearchHit {
                id: e.id.clone(),
                title: e.title.clone(),
                parent_id: e.parent_id.clone(),
                snippet,
                score,
                updated_at: e.updated_at.clone(),
            },
        ));
    }
    hits.sort_by(|a, b| {
        b.0.cmp(&a.0)
            .then(b.1.updated_at.cmp(&a.1.updated_at))
            .then(a.1.id.cmp(&b.1.id))
    });
    Ok(SearchOut {
        results: hits.into_iter().take(limit).map(|(_, h)| h).collect(),
        skipped_files: snap.load_errors.len(),
    })
}

/// 찾은 자리 앞뒤 60글자 (글자 경계에서 자른다)
fn snippet_at(body: &str, at: usize, len: usize) -> String {
    let start = body[..at]
        .char_indices()
        .rev()
        .nth(60)
        .map_or(0, |(i, _)| i);
    let end_from = (at + len).min(body.len());
    let end = body[end_from..]
        .char_indices()
        .nth(60)
        .map_or(body.len(), |(i, _)| end_from + i);
    body[start..end]
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

pub fn read(ws: &Workspace, args: ReadArgs) -> Res<ReadOut> {
    let page = load_page(ws, &args.page_id)?;
    let e = entry_of(page.clone()).ok_or("페이지 형식이 올바르지 않아요")?;
    let format = args.format.unwrap_or(ReadFormat::Markdown);
    let content = page
        .get("content")
        .cloned()
        .unwrap_or_else(|| json!({ "type": "doc", "content": [] }));
    let (markdown, content) = match format {
        ReadFormat::Markdown => {
            let title_of = |pid: &str| page_title(ws, pid);
            (Some(doc_to_markdown_with(&content, &title_of)), None)
        }
        ReadFormat::TiptapJson => (None, Some(content)),
    };
    Ok(ReadOut {
        id: e.id,
        title: e.title,
        kind: e.kind,
        parent_id: e.parent_id,
        tags: e.tags,
        status: e.status,
        due: e.due,
        created_at: e.created_at,
        updated_at: e.updated_at,
        trashed: e.trashed,
        format,
        markdown,
        content,
    })
}

/// 새 페이지 문서: 앱의 기본 생성 규칙과 같게 필수 필드만 넣고, 나머지(layout 등)는
/// 앱이 읽을 때 채운다 (src/lib/storage/schema.ts의 `normalizePage`).
pub fn new_page_value(
    id: &str,
    kind: &str,
    title: &str,
    parent_id: Option<&str>,
    content: Value,
    now: &str,
) -> Value {
    json!({
        "schemaVersion": PAGE_SCHEMA_VERSION,
        "id": id,
        "kind": kind,
        "title": title,
        "icon": null,
        "cover": null,
        "parentId": parent_id,
        "props": { "tags": [], "status": null, "assignee": null, "due": null, "values": {} },
        "collection": null,
        "content": content,
        "createdAt": now,
        "updatedAt": now,
        "trashedAt": null,
        "template": null,
    })
}

pub fn create(ws: &Workspace, args: CreateArgs) -> Res<WriteOut> {
    let title = clean_title(&args.title)?;
    let md = args.markdown.unwrap_or_default();
    check_markdown(&md)?;
    if let Some(p) = args.parent_id.as_deref() {
        check_page_id(p)?;
        check_parent(ws, p, "page")?;
    }
    let id = new_page_id()?;
    if ws.read_page(&id).map_err(storage_err)?.is_some() {
        return Err("새 id가 이미 있어요. 다시 시도해 주세요".into());
    }
    let title_of = |pid: &str| page_title(ws, pid);
    let refs = Refs {
        page_id: Some(&id),
        title_of: &title_of,
    };
    let content = markdown_to_doc_with(&md, &refs);
    let page = new_page_value(
        &id,
        "page",
        &title,
        args.parent_id.as_deref(),
        content,
        &now_iso(),
    );
    ws.write_page(&page).map_err(storage_err)?;
    super::cache::forget(ws);
    Ok(write_out(WriteOutcome {
        page,
        changed: true,
        history_saved: false,
    }))
}

pub fn append(ws: &Workspace, args: AppendArgs) -> Res<WriteOut> {
    check_markdown(&args.markdown)?;
    let before = load_live_page(ws, &args.page_id)?;
    let mut after = before.clone();
    let title_of = |pid: &str| page_title(ws, pid);
    let refs = Refs {
        page_id: before.get("id").and_then(Value::as_str),
        title_of: &title_of,
    };
    let addition = markdown_to_doc_with(&args.markdown, &refs);
    let added = addition
        .get("content")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    if added.is_empty() {
        return Err("덧붙일 내용이 없어요".into());
    }
    let mut doc = after
        .get("content")
        .cloned()
        .unwrap_or_else(|| json!({ "type": "doc", "content": [] }));
    if !doc.is_object() {
        doc = json!({ "type": "doc", "content": [] });
    }
    let list = doc
        .as_object_mut()
        .map(|o| o.entry("content").or_insert_with(|| json!([])))
        .and_then(Value::as_array_mut)
        .ok_or("페이지 본문 형식이 올바르지 않아요")?;
    list.extend(added);
    after["content"] = doc;
    after["updatedAt"] = json!(now_iso());
    Ok(write_out(save_changes(ws, &before, after)?))
}

pub fn update(ws: &Workspace, args: UpdateArgs) -> Res<WriteOut> {
    if args.title.is_none() && args.markdown.is_none() {
        return Err("바꿀 제목(title)이나 본문(markdown) 중 하나는 넣어 주세요".into());
    }
    let title = args.title.as_deref().map(clean_title).transpose()?;
    if let Some(md) = args.markdown.as_deref() {
        check_markdown(md)?;
    }
    let before = load_live_page(ws, &args.page_id)?;
    let mut after = before.clone();
    if let Some(t) = title {
        after["title"] = json!(t);
    }
    if let Some(md) = args.markdown.as_deref() {
        let title_of = |pid: &str| page_title(ws, pid);
        let refs = Refs {
            page_id: before.get("id").and_then(Value::as_str),
            title_of: &title_of,
        };
        after["content"] = markdown_to_doc_with(md, &refs);
    }
    after["updatedAt"] = json!(now_iso());
    Ok(write_out(save_changes(ws, &before, after)?))
}

pub fn move_page(ws: &Workspace, args: MoveArgs) -> Res<WriteOut> {
    let before = load_live_page(ws, &args.page_id)?;
    let kind = before
        .get("kind")
        .and_then(Value::as_str)
        .unwrap_or("page")
        .to_string();
    let snap = snapshot(ws)?;
    if let Some(p) = args.parent_id.as_deref() {
        check_page_id(p)?;
        if p == args.page_id {
            return Err("페이지를 자기 자신 아래로 옮길 수 없어요".into());
        }
        check_parent(ws, p, &kind)?;
        if snap.ancestors(p).iter().any(|a| a == &args.page_id) {
            return Err("하위 페이지 아래로는 옮길 수 없어요 (순환이 생겨요)".into());
        }
    }
    let mut after = before.clone();
    after["parentId"] = match &args.parent_id {
        Some(p) => json!(p),
        None => Value::Null,
    };
    after["updatedAt"] = json!(now_iso());
    Ok(write_out(save_changes(ws, &before, after)?))
}

pub fn trash(ws: &Workspace, args: TrashArgs) -> Res<WriteOut> {
    let before = load_page(ws, &args.page_id)?;
    if before.get("template").is_some_and(|t| !t.is_null()) {
        return Err("템플릿 페이지는 MCP로 휴지통에 넣을 수 없어요".into());
    }
    if before.get("trashedAt").is_some_and(|t| !t.is_null()) {
        return Ok(write_out(WriteOutcome {
            page: before,
            changed: false,
            history_saved: false,
        }));
    }
    let now = now_iso();
    let mut after = before.clone();
    after["trashedAt"] = json!(now);
    after["updatedAt"] = json!(now);
    Ok(write_out(save_changes(ws, &before, after)?))
}

// ---------------------------------------------------------------------------
// 리소스용 텍스트
// ---------------------------------------------------------------------------

/// `cetusnote://page/{id}` 본문: 제목 줄 + 메타 + Markdown 본문
pub fn page_resource_text(ws: &Workspace, id: &str) -> Res<String> {
    let page = load_page(ws, id)?;
    let e = entry_of(page.clone()).ok_or("페이지 형식이 올바르지 않아요")?;
    let mut meta = vec![format!("id: {}", e.id)];
    if let Some(p) = &e.parent_id {
        meta.push(format!("parentId: {p}"));
    }
    if !e.tags.is_empty() {
        meta.push(format!("tags: {}", e.tags.join(", ")));
    }
    let title_of = |pid: &str| page_title(ws, pid);
    let body = doc_to_markdown_with(page.get("content").unwrap_or(&Value::Null), &title_of);
    Ok(format!(
        "# {}\n\n> {}\n\n{}",
        e.title,
        meta.join(" · "),
        body
    ))
}

/// `cetusnote://tree`: 보이는 페이지의 개요 글
pub fn tree_resource_text(ws: &Workspace) -> Res<String> {
    let snap = snapshot(ws)?;
    let items: Vec<PageSummary> = snap
        .flatten(None, false)
        .into_iter()
        .filter_map(|(id, depth)| snap.entries.get(&id).map(|e| (e, depth)))
        .map(|(e, depth)| PageSummary {
            id: e.id.clone(),
            title: e.title.clone(),
            kind: e.kind.clone(),
            parent_id: e.parent_id.clone(),
            depth,
            tags: e.tags.clone(),
            status: e.status.clone(),
            due: e.due.clone(),
            updated_at: e.updated_at.clone(),
            trashed: e.trashed,
        })
        .collect();
    Ok(outline_text(&items))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture() -> (tempfile::TempDir, Workspace) {
        let dir = tempfile::tempdir().expect("임시 폴더");
        let ws = Workspace::open(dir.path().to_path_buf()).expect("워크스페이스");
        (dir, ws)
    }

    fn make(ws: &Workspace, title: &str, parent: Option<&str>, md: &str) -> String {
        create(
            ws,
            CreateArgs {
                title: title.into(),
                parent_id: parent.map(str::to_string),
                markdown: Some(md.into()),
            },
        )
        .expect("만들기")
        .id
    }

    #[test]
    fn ids_are_valid_ulids_and_time_sorted() {
        let a = new_page_id().unwrap();
        assert!(is_valid_id(&a), "{a}");
        let b = new_page_id().unwrap();
        assert_ne!(a, b);
        assert!(is_valid_id(&b));
    }

    #[test]
    fn iso_now_has_millisecond_utc_shape() {
        let s = now_iso();
        assert_eq!(s.len(), 24, "{s}");
        assert!(s.ends_with('Z') && s.as_bytes()[10] == b'T');
        assert_eq!(civil_from_days(0), (1970, 1, 1));
        assert_eq!(civil_from_days(20_000), (2024, 10, 4));
    }

    #[test]
    fn create_then_read_round_trips_markdown() {
        let (_d, ws) = fixture();
        let id = make(&ws, "회의록", None, "# 안건\n\n- [ ] 예산\n- 일정");
        let out = read(
            &ws,
            ReadArgs {
                page_id: id.clone(),
                format: None,
            },
        )
        .unwrap();
        assert_eq!(out.title, "회의록");
        assert_eq!(out.format, ReadFormat::Markdown);
        let md = out.markdown.unwrap();
        assert!(md.contains("# 안건"));
        assert!(md.contains("- [ ] 예산"));
        // 저장 파일에는 앱 형식 필드가 들어 있다
        let raw = ws.read_page(&id).unwrap().unwrap();
        assert_eq!(raw["schemaVersion"], PAGE_SCHEMA_VERSION);
        assert_eq!(raw["content"]["type"], "doc");
        assert!(raw.get("layout").is_none(), "layout은 앱이 채운다");
    }

    #[test]
    fn schema_version_matches_app_constant() {
        // 앱(TS)의 PAGE_SCHEMA_VERSION과 한 값으로 묶여 있는지 소스에서 직접 확인한다
        let src = include_str!("../../../src/lib/storage/schema.ts");
        let app = src
            .lines()
            .find_map(|l| l.strip_prefix("export const PAGE_SCHEMA_VERSION = "))
            .and_then(|rest| rest.trim_end_matches(';').trim().parse::<u64>().ok())
            .expect("schema.ts에서 PAGE_SCHEMA_VERSION을 찾지 못했어요");
        assert_eq!(PAGE_SCHEMA_VERSION, app);
    }

    #[test]
    fn new_page_uses_v7_shape_without_legacy_full_width() {
        // v7: layout.fullWidth는 없어졌다. 새 페이지는 layout을 넣지 않고(앱이 채운다) width도 없다(상위를 따른다)
        let v = new_page_value("abc", "page", "제목", None, json!({ "type": "doc" }), "now");
        assert_eq!(v["schemaVersion"], 7);
        assert!(v.get("layout").is_none());
        assert!(!v.to_string().contains("fullWidth"));
        assert!(!v.to_string().contains("\"width\""));
    }

    #[test]
    fn read_tiptap_json_returns_raw_document() {
        let (_d, ws) = fixture();
        let id = make(&ws, "문서", None, "본문");
        let out = read(
            &ws,
            ReadArgs {
                page_id: id,
                format: Some(ReadFormat::TiptapJson),
            },
        )
        .unwrap();
        assert!(out.markdown.is_none());
        assert_eq!(out.content.unwrap()["type"], "doc");
    }

    #[test]
    fn list_is_tree_ordered_paginated_and_skips_trash() {
        let (_d, ws) = fixture();
        let root = make(&ws, "루트", None, "");
        let child = make(&ws, "자식", Some(&root), "");
        let _grand = make(&ws, "손자", Some(&child), "");
        let other = make(&ws, "다른", None, "");
        trash(
            &ws,
            TrashArgs {
                page_id: other.clone(),
            },
        )
        .unwrap();

        let all = list(
            &ws,
            ListArgs {
                parent_id: None,
                format: None,
                include_trashed: None,
                limit: None,
                cursor: None,
            },
        )
        .unwrap();
        assert_eq!(all.total, 3, "휴지통 제외");
        assert_eq!(all.items[0].id, root);
        assert_eq!(all.items[0].depth, 0);
        assert_eq!(all.items[1].depth, 1);
        assert_eq!(all.items[2].depth, 2);
        assert!(all.next_cursor.is_none());

        let page1 = list(
            &ws,
            ListArgs {
                parent_id: None,
                format: None,
                include_trashed: None,
                limit: Some(2),
                cursor: None,
            },
        )
        .unwrap();
        assert_eq!(page1.items.len(), 2);
        assert_eq!(page1.next_cursor.as_deref(), Some("2"));
        let page2 = list(
            &ws,
            ListArgs {
                parent_id: None,
                format: None,
                include_trashed: None,
                limit: Some(2),
                cursor: page1.next_cursor,
            },
        )
        .unwrap();
        assert_eq!(page2.items.len(), 1);
        assert!(page2.next_cursor.is_none());

        let with_trash = list(
            &ws,
            ListArgs {
                parent_id: None,
                format: None,
                include_trashed: Some(true),
                limit: None,
                cursor: None,
            },
        )
        .unwrap();
        assert_eq!(with_trash.total, 4);

        let sub = list(
            &ws,
            ListArgs {
                parent_id: Some(root.clone()),
                format: Some(ListFormat::Tree),
                include_trashed: None,
                limit: None,
                cursor: None,
            },
        )
        .unwrap();
        assert_eq!(sub.total, 2, "루트 아래 후손만");
        assert!(outline_text(&sub.items).contains("  - 손자"));
    }

    #[test]
    fn children_of_a_trashed_page_are_hidden_like_the_app() {
        let (_d, ws) = fixture();
        let parent = make(&ws, "접힐 부모", None, "");
        let _kid = make(&ws, "안의 페이지", Some(&parent), "");
        trash(
            &ws,
            TrashArgs {
                page_id: parent.clone(),
            },
        )
        .unwrap();
        let shown = list(
            &ws,
            ListArgs {
                parent_id: None,
                format: None,
                include_trashed: None,
                limit: None,
                cursor: None,
            },
        )
        .unwrap();
        assert_eq!(shown.total, 0, "휴지통 부모의 자식도 숨긴다");
        let all = list(
            &ws,
            ListArgs {
                parent_id: None,
                format: None,
                include_trashed: Some(true),
                limit: None,
                cursor: None,
            },
        )
        .unwrap();
        assert_eq!(all.total, 2);
    }

    #[test]
    fn list_rejects_bad_cursor_and_limit() {
        let (_d, ws) = fixture();
        assert!(
            list(
                &ws,
                ListArgs {
                    parent_id: None,
                    format: None,
                    include_trashed: None,
                    limit: Some(0),
                    cursor: None
                }
            )
            .is_err()
        );
        assert!(
            list(
                &ws,
                ListArgs {
                    parent_id: None,
                    format: None,
                    include_trashed: None,
                    limit: Some(500),
                    cursor: None
                }
            )
            .is_err()
        );
        assert!(
            list(
                &ws,
                ListArgs {
                    parent_id: None,
                    format: None,
                    include_trashed: None,
                    limit: None,
                    cursor: Some("abc".into())
                }
            )
            .is_err()
        );
    }

    #[test]
    fn search_matches_title_and_body_all_terms() {
        let (_d, ws) = fixture();
        let a = make(&ws, "예산 계획", None, "분기 지출을 정리한다");
        let b = make(&ws, "여행", None, "예산은 나중에");
        let _c = make(&ws, "무관", None, "전혀 다른 내용");
        let out = search(
            &ws,
            SearchArgs {
                query: "예산".into(),
                limit: None,
            },
        )
        .unwrap();
        let ids: Vec<&str> = out.results.iter().map(|h| h.id.as_str()).collect();
        assert!(ids.contains(&a.as_str()) && ids.contains(&b.as_str()));
        assert_eq!(out.results[0].id, a, "제목 일치가 먼저");
        let multi = search(
            &ws,
            SearchArgs {
                query: "예산 지출".into(),
                limit: None,
            },
        )
        .unwrap();
        assert_eq!(multi.results.len(), 1);
        assert!(multi.results[0].snippet.contains("지출"));
        assert!(
            search(
                &ws,
                SearchArgs {
                    query: "  ".into(),
                    limit: None
                }
            )
            .is_err()
        );
    }

    #[test]
    fn append_keeps_existing_body_and_adds_blocks() {
        let (_d, ws) = fixture();
        let id = make(&ws, "일지", None, "첫 문단");
        let out = append(
            &ws,
            AppendArgs {
                page_id: id.clone(),
                markdown: "## 추가\n\n둘째".into(),
            },
        )
        .unwrap();
        assert!(out.changed && out.history_saved);
        let md = read(
            &ws,
            ReadArgs {
                page_id: id,
                format: None,
            },
        )
        .unwrap()
        .markdown
        .unwrap();
        assert!(md.find("첫 문단").unwrap() < md.find("## 추가").unwrap());
        assert!(md.contains("둘째"));
    }

    #[test]
    fn update_replaces_body_and_title_and_records_history() {
        let (_d, ws) = fixture();
        let id = make(&ws, "옛 제목", None, "옛 본문");
        let out = update(
            &ws,
            UpdateArgs {
                page_id: id.clone(),
                title: Some("새 제목".into()),
                markdown: Some("새 본문".into()),
            },
        )
        .unwrap();
        assert_eq!(out.title, "새 제목");
        assert!(out.history_saved);
        let versions = ws.list_versions(&id).unwrap();
        assert_eq!(versions.len(), 1, "바꾸기 전 버전이 남는다");
        let old = ws.read_version(&id, &versions[0].id).unwrap();
        assert_eq!(old["title"], "옛 제목");
        assert!(
            update(
                &ws,
                UpdateArgs {
                    page_id: id.clone(),
                    title: None,
                    markdown: None
                }
            )
            .is_err()
        );
    }

    #[test]
    fn update_with_same_content_is_a_noop() {
        let (_d, ws) = fixture();
        let id = make(&ws, "같은", None, "본문");
        let md = read(
            &ws,
            ReadArgs {
                page_id: id.clone(),
                format: None,
            },
        )
        .unwrap()
        .markdown
        .unwrap();
        let out = update(
            &ws,
            UpdateArgs {
                page_id: id.clone(),
                title: Some("같은".into()),
                markdown: Some(md),
            },
        )
        .unwrap();
        assert!(!out.changed);
        assert!(ws.list_versions(&id).unwrap().is_empty());
    }

    #[test]
    fn move_checks_cycles_collections_and_trash() {
        let (_d, ws) = fixture();
        let a = make(&ws, "A", None, "");
        let b = make(&ws, "B", Some(&a), "");
        assert!(
            move_page(
                &ws,
                MoveArgs {
                    page_id: a.clone(),
                    parent_id: Some(b.clone())
                }
            )
            .is_err(),
            "순환"
        );
        assert!(
            move_page(
                &ws,
                MoveArgs {
                    page_id: a.clone(),
                    parent_id: Some(a.clone())
                }
            )
            .is_err(),
            "자기 아래"
        );
        let c = make(&ws, "C", None, "");
        let moved = move_page(
            &ws,
            MoveArgs {
                page_id: b.clone(),
                parent_id: Some(c.clone()),
            },
        )
        .unwrap();
        assert_eq!(moved.parent_id.as_deref(), Some(c.as_str()));
        let root = move_page(
            &ws,
            MoveArgs {
                page_id: b.clone(),
                parent_id: None,
            },
        )
        .unwrap();
        assert!(root.parent_id.is_none());
        trash(&ws, TrashArgs { page_id: c.clone() }).unwrap();
        assert!(
            move_page(
                &ws,
                MoveArgs {
                    page_id: a.clone(),
                    parent_id: Some(c)
                }
            )
            .is_err(),
            "휴지통 아래"
        );
    }

    #[test]
    fn move_into_collection_only_accepts_documents() {
        let (_d, ws) = fixture();
        let coll = make(&ws, "컬렉션", None, "");
        let mut raw = ws.read_page(&coll).unwrap().unwrap();
        raw["kind"] = json!("collection");
        ws.write_page(&raw).unwrap();
        let doc = make(&ws, "문서", None, "");
        assert!(
            move_page(
                &ws,
                MoveArgs {
                    page_id: doc,
                    parent_id: Some(coll)
                }
            )
            .is_ok()
        );
    }

    #[test]
    fn folder_may_sit_under_a_document_but_not_a_collection() {
        let (_d, ws) = fixture();
        let doc = make(&ws, "문서", None, "");
        let folder = make(&ws, "폴더", None, "");
        let mut raw = ws.read_page(&folder).unwrap().unwrap();
        raw["kind"] = json!("folder");
        ws.write_page(&raw).unwrap();
        let moved = move_page(
            &ws,
            MoveArgs {
                page_id: folder.clone(),
                parent_id: Some(doc.clone()),
            },
        )
        .unwrap();
        assert_eq!(moved.parent_id.as_deref(), Some(doc.as_str()));
        let inner = make(&ws, "안", Some(&folder), "");
        assert!(ws.read_page(&inner).unwrap().is_some());
        assert!(
            move_page(
                &ws,
                MoveArgs {
                    page_id: doc.clone(),
                    parent_id: Some(inner)
                }
            )
            .is_err(),
            "폴더 안으로 옮기면 고리"
        );
        let coll = make(&ws, "컬렉션", None, "");
        let mut raw = ws.read_page(&coll).unwrap().unwrap();
        raw["kind"] = json!("collection");
        ws.write_page(&raw).unwrap();
        assert!(
            move_page(
                &ws,
                MoveArgs {
                    page_id: folder.clone(),
                    parent_id: Some(coll)
                }
            )
            .is_err(),
            "컬렉션 아래에는 폴더를 둘 수 없다"
        );
    }

    #[test]
    fn trash_only_marks_and_never_deletes() {
        let (_d, ws) = fixture();
        let id = make(&ws, "지울 것", None, "본문");
        let out = trash(
            &ws,
            TrashArgs {
                page_id: id.clone(),
            },
        )
        .unwrap();
        assert!(out.trashed);
        assert!(ws.read_page(&id).unwrap().is_some(), "파일은 남아 있다");
        let again = trash(
            &ws,
            TrashArgs {
                page_id: id.clone(),
            },
        )
        .unwrap();
        assert!(!again.changed);
        assert!(
            append(
                &ws,
                AppendArgs {
                    page_id: id,
                    markdown: "x".into()
                }
            )
            .is_err()
        );
    }

    #[test]
    fn invalid_ids_and_missing_pages_are_tool_errors_not_panics() {
        let (_d, ws) = fixture();
        for bad in [
            "../../etc/passwd",
            "",
            "01JD000000000000000000000/../x",
            "lowercase0000000000000000x",
        ] {
            let r = read(
                &ws,
                ReadArgs {
                    page_id: bad.into(),
                    format: None,
                },
            );
            assert!(r.is_err(), "{bad}");
        }
        let missing = read(
            &ws,
            ReadArgs {
                page_id: "01JD0000000000000000000000".into(),
                format: None,
            },
        );
        assert!(missing.unwrap_err().contains("찾을 수 없어요"));
        assert!(
            create(
                &ws,
                CreateArgs {
                    title: "  ".into(),
                    parent_id: None,
                    markdown: None
                }
            )
            .is_err()
        );
        assert!(
            create(
                &ws,
                CreateArgs {
                    title: "x".into(),
                    parent_id: Some("../bad".into()),
                    markdown: None
                }
            )
            .is_err()
        );
    }

    #[test]
    fn resource_texts_render_markdown() {
        let (_d, ws) = fixture();
        let root = make(&ws, "루트", None, "본문 **굵게**");
        let _child = make(&ws, "자식", Some(&root), "");
        let text = page_resource_text(&ws, &root).unwrap();
        assert!(text.starts_with("# 루트"));
        assert!(text.contains("**굵게**"));
        let tree = tree_resource_text(&ws).unwrap();
        assert!(tree.contains("- 루트") && tree.contains("  - 자식"));
    }
}
