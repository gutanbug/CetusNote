//! MCP 검색·목록 성능 측정 (SYS-10). 기본 테스트에서는 건너뛴다.
//! 실행: `PERF_WORKSPACE=<페이지 n개 워크스페이스> cargo test --release mcp::bench -- --ignored --nocapture`
use super::tools::{SearchArgs, search, snapshot};
use crate::storage::Workspace;
use serde_json::json;
use std::time::Instant;

fn ms(f: impl Fn()) -> f64 {
    let s = Instant::now();
    f();
    s.elapsed().as_secs_f64() * 1000.0
}

fn median(mut v: Vec<f64>) -> f64 {
    v.sort_by(|a, b| a.partial_cmp(b).unwrap());
    v[v.len() / 2]
}

#[test]
#[ignore]
fn perf_mcp_search_and_snapshot() {
    let Some(dir) = std::env::var_os("PERF_WORKSPACE") else {
        eprintln!("PERF skip: PERF_WORKSPACE 없음");
        return;
    };
    let ws = Workspace::open(dir.into()).unwrap();
    let args = || -> SearchArgs {
        serde_json::from_value(json!({ "query": "회의 메모", "limit": 10 })).unwrap()
    };
    let pages = snapshot(&ws).unwrap().entries.len();
    let cold = ms(|| {
        search(&ws, args()).unwrap();
    });
    let warm: Vec<f64> = (0..7)
        .map(|_| {
            ms(|| {
                search(&ws, args()).unwrap();
            })
        })
        .collect();
    let snap: Vec<f64> = (0..7)
        .map(|_| {
            ms(|| {
                snapshot(&ws).unwrap();
            })
        })
        .collect();
    // 창(500ms)이 지난 뒤의 호출: 전체 확인(stat)이 도는 경우
    let paced: Vec<f64> = (0..5)
        .map(|_| {
            std::thread::sleep(std::time::Duration::from_millis(600));
            ms(|| {
                search(&ws, args()).unwrap();
            })
        })
        .collect();
    eprintln!(
        "PERF pages={pages} search_paced_median={:.1} ms",
        median(paced)
    );
    eprintln!("PERF pages={pages} search_cold={cold:.1} ms");
    eprintln!(
        "PERF pages={pages} search_warm_median={:.1} ms",
        median(warm)
    );
    eprintln!("PERF pages={pages} snapshot_median={:.1} ms", median(snap));
}
