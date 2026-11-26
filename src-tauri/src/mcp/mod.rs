//! CetusNote MCP 서버 (DATA-12). 앱 실행 파일을 `--mcp`로 실행하면 창을 띄우지 않고
//! stdio MCP 서버가 된다. 저장은 앱과 같은 `storage` 계층을 거치므로 파일 형식·버전 기록이 같다.
//!
//! 사용법: `<앱 실행 파일> --mcp [--workspace <폴더>]`
//! 워크스페이스를 생략하면 앱이 마지막으로 연 워크스페이스(`app-state.json`의 `workspace`)를 쓴다.
//! stdout은 프로토콜 전용이다. 로그는 모두 stderr로 쓴다.

pub mod markdown;
pub mod tools;

use crate::storage::{self, Workspace};
use rmcp::model::{
    CallToolRequestParams, CallToolResponse, CallToolResult, ContentBlock, Implementation,
    ListResourceTemplatesResult, ListResourcesResult, ListToolsResult, PaginatedRequestParams,
    ReadResourceRequestParams, ReadResourceResponse, ReadResourceResult, Resource,
    ResourceContents, ResourceTemplate, ServerCapabilities, ServerConfig, Tool, ToolAnnotations,
};
use rmcp::schemars::JsonSchema;
use rmcp::service::RequestContext;
use rmcp::{ErrorData as McpError, RoleServer, ServerHandler};
use serde::Serialize;
use serde_json::Value;
use std::path::PathBuf;
use std::sync::Arc;
use tools::{ListFormat, Res};

pub const SERVER_NAME: &str = "cetusnote";
const URI_PAGE_PREFIX: &str = "cetusnote://page/";
const URI_TREE: &str = "cetusnote://tree";
/// 리소스 목록에 개별 항목으로 올리는 페이지 수 상한 (나머지는 cetusnote://tree 와 검색으로)
const RESOURCE_LIST_MAX: usize = 200;

const INSTRUCTIONS: &str = "CetusNote notes server. Pages form a tree; each page has a title, \
an optional parent and a body. Use search_pages or list_pages to find ids, read_page to read a body \
as Markdown, create_page / append_to_page / update_page / move_page to write, and trash_page to move \
a page to the app's trash (nothing is hard-deleted). Writes go straight to the workspace folder that the \
CetusNote app uses; if the app has unsaved edits on the same page, the app keeps its version and shows \
an external-change notice.";

// ---------------------------------------------------------------------------
// 명령줄 · 워크스페이스 찾기
// ---------------------------------------------------------------------------

/// `--mcp`가 있으면 MCP 서버로 실행하고 종료 코드를 돌려준다. 없으면 None (앱을 평소대로 띄운다).
pub fn run_from_args(app_identifier: &str) -> Option<i32> {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if !args.iter().any(|a| a == "--mcp") {
        return None;
    }
    Some(match run(&args, app_identifier) {
        Ok(()) => 0,
        Err((code, msg)) => {
            eprintln!("cetusnote --mcp: {msg}");
            code
        }
    })
}

fn run(args: &[String], app_identifier: &str) -> Result<(), (i32, String)> {
    let mut workspace_arg: Option<PathBuf> = None;
    let mut it = args.iter();
    while let Some(a) = it.next() {
        match a.as_str() {
            "--mcp" => {}
            "--workspace" => {
                let p = it
                    .next()
                    .ok_or((2, "--workspace 뒤에 폴더 경로가 필요해요".to_string()))?;
                workspace_arg = Some(PathBuf::from(p));
            }
            other if other.starts_with("--workspace=") => {
                workspace_arg = Some(PathBuf::from(&other["--workspace=".len()..]));
            }
            // macOS가 붙이는 -psn_ 인자는 무시한다
            other if other.starts_with("-psn_") => {}
            other => {
                return Err((
                    2,
                    format!("알 수 없는 옵션: {other}\n사용법: <앱> --mcp [--workspace <폴더>]"),
                ));
            }
        }
    }
    let root = match workspace_arg {
        Some(p) => p.canonicalize().map_err(|e| {
            (
                2,
                format!("워크스페이스 폴더를 찾을 수 없어요 ({}): {e}", p.display()),
            )
        })?,
        None => last_workspace(app_identifier).map_err(|m| (2, m))?,
    };
    let ws = Workspace::attach(root.clone()).map_err(|e| (2, e.message))?;
    eprintln!("cetusnote --mcp: 워크스페이스 {}", root.display());
    serve_stdio(ws).map_err(|m| (1, m))
}

/// 앱이 마지막으로 연 워크스페이스 (앱 설정 폴더의 app-state.json, `src-tauri/src/commands.rs`의 APP_STATE_FILE과 같은 파일)
fn last_workspace(app_identifier: &str) -> Result<PathBuf, String> {
    let config = dirs::config_dir().ok_or("설정 폴더를 찾을 수 없어요")?;
    let state_file = config.join(app_identifier).join("app-state.json");
    let saved = storage::read_json_opt(&state_file)
        .ok()
        .flatten()
        .ok_or_else(|| {
            "앱에서 워크스페이스를 먼저 열어 주세요. 또는 --workspace <폴더>를 넘겨 주세요"
                .to_string()
        })?;
    saved
        .get("workspace")
        .and_then(Value::as_str)
        .map(PathBuf::from)
        .ok_or_else(|| {
            "마지막 워크스페이스 기록이 없어요. --workspace <폴더>를 넘겨 주세요".to_string()
        })
}

// ---------------------------------------------------------------------------
// 서버
// ---------------------------------------------------------------------------

#[derive(Clone)]
struct CetusServer {
    ws: Arc<Workspace>,
    /// 도구·리소스 호출을 한 번에 하나씩 처리한다. 같은 페이지를 두 호출이 동시에 읽고 쓰면 변경이 사라지므로
    gate: Arc<std::sync::Mutex<()>>,
}

impl CetusServer {
    /// 잠금 중에 실행하는 짧은 동기 작업 (await 없음)
    fn locked<T>(&self, f: impl FnOnce(&Workspace) -> T) -> T {
        let _guard = self.gate.lock().unwrap_or_else(|e| e.into_inner());
        f(self.ws.as_ref())
    }
}

fn serve_stdio(ws: Workspace) -> Result<(), String> {
    let server = CetusServer {
        ws: Arc::new(ws),
        gate: Arc::new(std::sync::Mutex::new(())),
    };
    tauri::async_runtime::block_on(async move {
        let running = rmcp::serve_server(server, rmcp::transport::stdio())
            .await
            .map_err(|e| format!("MCP 연결을 시작하지 못했어요: {e}"))?;
        running
            .waiting()
            .await
            .map_err(|e| format!("MCP 서버가 비정상 종료했어요: {e}"))?;
        Ok(())
    })
}

/// 도구 결과: 구조화된 값 + 사람이 읽는 요약 글 (text 폴백)
fn ok_result<T: Serialize>(value: &T, summary: String) -> Result<CallToolResponse, McpError> {
    let structured = serde_json::to_value(value)
        .map_err(|e| McpError::internal_error(format!("결과를 만들지 못했어요: {e}"), None))?;
    let mut result = CallToolResult::structured(structured);
    result.content = vec![ContentBlock::text(summary)];
    Ok(result.into())
}

/// 도구 실패는 `isError` 결과로 돌려준다 (모델이 고쳐서 다시 부를 수 있게)
fn err_result(message: String) -> Result<CallToolResponse, McpError> {
    Ok(CallToolResult::error(vec![ContentBlock::text(message)]).into())
}

fn finish<T: Serialize>(
    r: Res<T>,
    summary: impl FnOnce(&T) -> String,
) -> Result<CallToolResponse, McpError> {
    match r {
        Ok(v) => {
            let s = summary(&v);
            ok_result(&v, s)
        }
        Err(msg) => err_result(msg),
    }
}

fn parse_args<A: serde::de::DeserializeOwned>(
    args: Option<serde_json::Map<String, Value>>,
) -> Result<A, McpError> {
    serde_json::from_value(Value::Object(args.unwrap_or_default()))
        .map_err(|e| McpError::invalid_params(format!("입력이 올바르지 않아요: {e}"), None))
}

impl ServerHandler for CetusServer {
    fn get_info(&self) -> ServerConfig {
        ServerConfig::new(
            ServerCapabilities::builder()
                .enable_tools()
                .enable_resources()
                .build(),
        )
        .with_server_info(Implementation::new(SERVER_NAME, env!("CARGO_PKG_VERSION")))
        .with_instructions(INSTRUCTIONS)
    }

    async fn list_tools(
        &self,
        _request: Option<PaginatedRequestParams>,
        _context: RequestContext<RoleServer>,
    ) -> Result<ListToolsResult, McpError> {
        Ok(ListToolsResult::with_all_items(tool_definitions()))
    }

    async fn call_tool(
        &self,
        request: CallToolRequestParams,
        _context: RequestContext<RoleServer>,
    ) -> Result<CallToolResponse, McpError> {
        let args = request.arguments;
        let name = request.name.to_string();
        self.locked(|ws| dispatch(ws, &name, args))
    }

    async fn list_resource_templates(
        &self,
        _request: Option<PaginatedRequestParams>,
        _context: RequestContext<RoleServer>,
    ) -> Result<ListResourceTemplatesResult, McpError> {
        let template = ResourceTemplate::new(format!("{URI_PAGE_PREFIX}{{page_id}}"), "page")
            .with_mime_type("text/markdown");
        Ok(ListResourceTemplatesResult::with_all_items(vec![template]))
    }

    async fn list_resources(
        &self,
        _request: Option<PaginatedRequestParams>,
        _context: RequestContext<RoleServer>,
    ) -> Result<ListResourcesResult, McpError> {
        let mut resources = vec![Resource::new(URI_TREE, "tree").with_mime_type("text/markdown")];
        let listed = tools::list(
            self.ws.as_ref(),
            tools::ListArgs {
                parent_id: None,
                format: None,
                include_trashed: None,
                limit: Some(RESOURCE_LIST_MAX),
                cursor: None,
            },
        )
        .map_err(|m| McpError::internal_error(m, None))?;
        for item in listed.items {
            resources.push(
                Resource::new(format!("{URI_PAGE_PREFIX}{}", item.id), item.title)
                    .with_mime_type("text/markdown"),
            );
        }
        Ok(ListResourcesResult::with_all_items(resources))
    }

    async fn read_resource(
        &self,
        request: ReadResourceRequestParams,
        _context: RequestContext<RoleServer>,
    ) -> Result<ReadResourceResponse, McpError> {
        let uri = request.uri.as_str();
        let text = if uri == URI_TREE {
            tools::tree_resource_text(self.ws.as_ref())
        } else if let Some(id) = uri.strip_prefix(URI_PAGE_PREFIX) {
            tools::page_resource_text(self.ws.as_ref(), id)
        } else {
            return Err(McpError::resource_not_found(
                format!("알 수 없는 리소스예요: {uri}"),
                None,
            ));
        }
        .map_err(|m| McpError::resource_not_found(m, None))?;
        Ok(ReadResourceResult::new(vec![
            ResourceContents::text(text, uri).with_mime_type("text/markdown"),
        ])
        .into())
    }
}

/// 도구 호출 한 건 (동기). `call_tool`이 잠금을 잡은 뒤 부른다
fn dispatch(
    ws: &Workspace,
    name: &str,
    args: Option<serde_json::Map<String, Value>>,
) -> Result<CallToolResponse, McpError> {
    match name {
        "list_pages" => {
            let a: tools::ListArgs = parse_args(args)?;
            let tree = a.format == Some(ListFormat::Tree);
            finish(tools::list(ws, a), move |out| {
                let mut text = if tree {
                    tools::outline_text(&out.items)
                } else {
                    tools::flat_text(&out.items)
                };
                if text.is_empty() {
                    text = "보여 줄 페이지가 없어요.".into();
                }
                let next = out
                    .next_cursor
                    .as_deref()
                    .map(|c| format!("\n다음 목록: cursor={c}"))
                    .unwrap_or_default();
                format!("{}개 중 {}개\n{text}{next}", out.total, out.items.len())
            })
        }
        "search_pages" => {
            let a: tools::SearchArgs = parse_args(args)?;
            finish(tools::search(ws, a), |out| {
                if out.results.is_empty() {
                    return "검색 결과가 없어요.".into();
                }
                out.results
                    .iter()
                    .map(|h| format!("- {} [{}] {}", h.title, h.id, h.snippet))
                    .collect::<Vec<_>>()
                    .join("\n")
            })
        }
        "read_page" => {
            let a: tools::ReadArgs = parse_args(args)?;
            finish(tools::read(ws, a), |out| {
                match (&out.markdown, &out.content) {
                    (Some(md), _) => format!("# {}\n\n{md}", out.title),
                    (_, Some(c)) => c.to_string(),
                    _ => out.title.clone(),
                }
            })
        }
        "create_page" => {
            let a: tools::CreateArgs = parse_args(args)?;
            finish(tools::create(ws, a), |out| {
                format!("만들었어요: {} [{}]", out.title, out.id)
            })
        }
        "append_to_page" => {
            let a: tools::AppendArgs = parse_args(args)?;
            finish(tools::append(ws, a), write_summary)
        }
        "update_page" => {
            let a: tools::UpdateArgs = parse_args(args)?;
            finish(tools::update(ws, a), write_summary)
        }
        "move_page" => {
            let a: tools::MoveArgs = parse_args(args)?;
            finish(tools::move_page(ws, a), write_summary)
        }
        "trash_page" => {
            let a: tools::TrashArgs = parse_args(args)?;
            finish(tools::trash(ws, a), write_summary)
        }
        other => Err(McpError::invalid_params(
            format!("알 수 없는 도구예요: {other}"),
            None,
        )),
    }
}

fn write_summary(out: &tools::WriteOut) -> String {
    let verb = if out.changed {
        "저장했어요"
    } else {
        "바뀐 내용이 없어요"
    };
    let trash = if out.trashed { " (휴지통)" } else { "" };
    format!("{verb}: {} [{}]{trash}", out.title, out.id)
}

// ---------------------------------------------------------------------------
// 도구 정의 (이름·설명·주석). 입력·출력 스키마는 타입에서 만든다
// ---------------------------------------------------------------------------

fn tool<I: JsonSchema + 'static, O: JsonSchema + 'static>(
    name: &'static str,
    description: &'static str,
    annotations: ToolAnnotations,
) -> Tool {
    Tool::new(name, description, rmcp::model::JsonObject::new())
        .with_input_schema::<I>()
        .with_output_schema::<O>()
        .with_title(name)
        .annotate(annotations)
}

fn tool_definitions() -> Vec<Tool> {
    use tools::*;
    vec![
        tool::<ListArgs, ListOut>(
            "list_pages",
            "List pages in the CetusNote workspace as a flat depth-first list (format=flat) or an indented outline (format=tree). Filter to the subtree under parent_id. Trashed pages and templates are excluded unless include_trashed is true. Paginate with limit and the returned nextCursor.",
            ToolAnnotations::new()
                .read_only(true)
                .destructive(false)
                .idempotent(true)
                .open_world(false),
        ),
        tool::<SearchArgs, SearchOut>(
            "search_pages",
            "Full-text search over page titles and bodies (case-insensitive; every space-separated term must match). Returns ranked hits with a short snippet. Use this to find page ids before reading.",
            ToolAnnotations::new()
                .read_only(true)
                .destructive(false)
                .idempotent(true)
                .open_world(false),
        ),
        tool::<ReadArgs, ReadOut>(
            "read_page",
            "Read one page: metadata and its body as Markdown (format=markdown, default) or the raw Tiptap JSON document (format=tiptap_json).",
            ToolAnnotations::new()
                .read_only(true)
                .destructive(false)
                .idempotent(true)
                .open_world(false),
        ),
        tool::<CreateArgs, WriteOut>(
            "create_page",
            "Create a new page with a title, optional parent page and an optional Markdown body. Body Markdown supports headings, paragraphs, bullet/numbered/task lists, quotes, fenced code blocks, horizontal rules, and bold/italic/strike/code/links. Tables and images are not converted.",
            ToolAnnotations::new()
                .read_only(false)
                .destructive(false)
                .idempotent(false)
                .open_world(false),
        ),
        tool::<AppendArgs, WriteOut>(
            "append_to_page",
            "Append Markdown blocks to the end of an existing page without changing the existing body. Use for logs and running notes.",
            ToolAnnotations::new()
                .read_only(false)
                .destructive(false)
                .idempotent(false)
                .open_world(false),
        ),
        tool::<UpdateArgs, WriteOut>(
            "update_page",
            "Change a page's title and/or replace its whole body with new Markdown. The previous version is saved to the page's version history first, so it can be restored in the app. Omit markdown to keep the body.",
            ToolAnnotations::new()
                .read_only(false)
                .destructive(true)
                .idempotent(true)
                .open_world(false),
        ),
        tool::<MoveArgs, WriteOut>(
            "move_page",
            "Move a page under another page, or to the top level when parent_id is null or omitted. Refuses moves that would create a cycle, targets in the trash, or non-document pages inside a collection.",
            ToolAnnotations::new()
                .read_only(false)
                .destructive(false)
                .idempotent(true)
                .open_world(false),
        ),
        tool::<TrashArgs, WriteOut>(
            "trash_page",
            "Move a page to the trash. This is recoverable in the app's trash; the tool never permanently deletes anything.",
            ToolAnnotations::new()
                .read_only(false)
                .destructive(true)
                .idempotent(true)
                .open_world(false),
        ),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    use serde_json::json;

    #[test]
    fn tool_names_and_annotations_follow_the_policy() {
        let defs = tool_definitions();
        let names: Vec<&str> = defs.iter().map(|t| t.name.as_ref()).collect();
        assert_eq!(
            names,
            [
                "list_pages",
                "search_pages",
                "read_page",
                "create_page",
                "append_to_page",
                "update_page",
                "move_page",
                "trash_page"
            ]
        );
        for t in &defs {
            let a = t.annotations.as_ref().expect("모든 도구에 주석");
            let read = a.read_only_hint == Some(true);
            if read {
                assert_eq!(a.destructive_hint, Some(false), "{}", t.name);
            }
            assert!(t.output_schema.is_some(), "{} 출력 스키마", t.name);
            assert!(
                t.input_schema.get("type").is_some(),
                "{} 입력 스키마",
                t.name
            );
        }
        let update = defs.iter().find(|t| t.name == "update_page").unwrap();
        assert_eq!(
            update.annotations.as_ref().unwrap().destructive_hint,
            Some(true)
        );
    }

    #[test]
    fn input_schema_rejects_unknown_fields() {
        let defs = tool_definitions();
        let create = defs.iter().find(|t| t.name == "create_page").unwrap();
        let schema = serde_json::to_value(&create.input_schema).unwrap();
        assert_eq!(schema["additionalProperties"], json!(false));
        assert!(schema["properties"].get("title").is_some());
    }

    #[test]
    fn default_workspace_needs_app_state_or_flag() {
        let err = last_workspace("dev.cetusnote.test.does-not-exist").unwrap_err();
        assert!(err.contains("--workspace"));
    }

    #[test]
    fn attach_refuses_folders_that_are_not_workspaces() {
        let dir = tempfile::tempdir().unwrap();
        let err = Workspace::attach(dir.path().to_path_buf()).unwrap_err();
        assert_eq!(err.code, "not_workspace");
        assert!(!dir.path().join("pages").exists(), "폴더를 만들지 않는다");
    }

    #[test]
    fn unknown_option_is_a_usage_error() {
        let r = run(&["--mcp".into(), "--bogus".into()], "x");
        assert_eq!(r.unwrap_err().0, 2);
    }
}
