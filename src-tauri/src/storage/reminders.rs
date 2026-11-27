//! 알림 저장 (SYS-16): 워크스페이스 루트의 `reminders.json` 한 파일.
//!
//! 형식: `{ "schemaVersion": 1, "reminders": [ … ] }`. 항목 안의 값은 Rust가 해석하지 않는다
//! (검증은 프론트 `features/reminders/model.ts`가 한다). 여기서는 최상위 모양, 크기, 원자적 쓰기만 맡는다.
//! 파일 이름은 고정이라 호출자가 경로를 넘기지 않는다(경로 검증 대상이 없다).

use super::{Result, StorageError, Workspace, atomic_write, read_json_opt};
use serde_json::Value;
use std::fs;

pub const REMINDERS_FILE: &str = "reminders.json";
pub const REMINDERS_SCHEMA: u64 = 1;
/// 알림 파일 크기 상한 (바이트). 수천 개 알림도 넉넉히 들어간다
pub const REMINDERS_MAX_BYTES: usize = 1024 * 1024;

impl Workspace {
    /// `reminders.json`을 읽는다. 파일이 없으면 `None`(알림 없음).
    /// 깨졌거나 모양이 다르면 오류를 돌려준다. 그래야 프론트가 빈 목록으로 덮어쓰지 않는다.
    pub fn read_reminders(&self) -> Result<Option<Value>> {
        let path = self.root.join(REMINDERS_FILE);
        if fs::metadata(&path).is_ok_and(|m| m.len() > REMINDERS_MAX_BYTES as u64) {
            return Err(too_large());
        }
        let value = read_json_opt(&path)?;
        if let Some(v) = &value {
            validate_reminders_file(v)?;
        }
        Ok(value)
    }

    /// `reminders.json`을 원자적으로 쓴다. 검사에 실패하면 기존 파일을 건드리지 않는다.
    pub fn write_reminders(&self, value: &Value) -> Result<()> {
        validate_reminders_file(value)?;
        let mut bytes = serde_json::to_vec_pretty(value)?;
        bytes.push(b'\n');
        if bytes.len() > REMINDERS_MAX_BYTES {
            return Err(too_large());
        }
        atomic_write(&self.root.join(REMINDERS_FILE), &bytes)?;
        Ok(())
    }
}

/// 최상위 모양 검사: 객체, `schemaVersion` 1, `reminders` 배열
pub fn validate_reminders_file(value: &Value) -> Result<()> {
    let invalid = || {
        StorageError::new(
            "invalid_reminders",
            "reminders.json은 schemaVersion 1과 reminders 배열을 가진 객체여야 해요",
        )
    };
    let obj = value.as_object().ok_or_else(invalid)?;
    if obj.get("schemaVersion").and_then(Value::as_u64) != Some(REMINDERS_SCHEMA) {
        return Err(invalid());
    }
    if !obj.get("reminders").is_some_and(Value::is_array) {
        return Err(invalid());
    }
    Ok(())
}

fn too_large() -> StorageError {
    StorageError::new("reminders_too_large", "알림 파일이 너무 커요 (1MB 이하)")
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn ws() -> (tempfile::TempDir, Workspace) {
        let dir = tempfile::tempdir().unwrap();
        let ws = Workspace::open(dir.path().to_path_buf()).unwrap();
        (dir, ws)
    }

    fn sample() -> Value {
        json!({
            "schemaVersion": 1,
            "reminders": [
                { "id": "r1", "kind": "alarm", "target": { "type": "none" }, "label": "회의", "at": "2026-11-28T09:00" }
            ]
        })
    }

    #[test]
    fn missing_file_reads_as_none() {
        let (_d, ws) = ws();
        assert_eq!(ws.read_reminders().unwrap(), None);
    }

    #[test]
    fn write_then_read_round_trips() {
        let (d, ws) = ws();
        ws.write_reminders(&sample()).unwrap();
        assert_eq!(ws.read_reminders().unwrap(), Some(sample()));
        // 파일은 워크스페이스 루트에 있고, 임시 파일은 남지 않는다
        assert!(d.path().join(REMINDERS_FILE).is_file());
        let stray: Vec<_> = fs::read_dir(d.path())
            .unwrap()
            .filter_map(|e| e.ok())
            .map(|e| e.file_name().to_string_lossy().into_owned())
            .filter(|n| n.ends_with(".tmp"))
            .collect();
        assert!(stray.is_empty(), "임시 파일이 남았어요: {stray:?}");
    }

    #[test]
    fn write_replaces_previous_content() {
        let (_d, ws) = ws();
        ws.write_reminders(&sample()).unwrap();
        let empty = json!({ "schemaVersion": 1, "reminders": [] });
        ws.write_reminders(&empty).unwrap();
        assert_eq!(ws.read_reminders().unwrap(), Some(empty));
    }

    #[test]
    fn rejects_wrong_shape_and_keeps_old_file() {
        let (_d, ws) = ws();
        ws.write_reminders(&sample()).unwrap();
        let bad = [
            json!([]),
            json!({ "reminders": [] }),
            json!({ "schemaVersion": 2, "reminders": [] }),
            json!({ "schemaVersion": 1, "reminders": {} }),
            json!("text"),
        ];
        for v in bad {
            let err = ws.write_reminders(&v).unwrap_err();
            assert_eq!(err.code, "invalid_reminders", "{v}");
        }
        assert_eq!(ws.read_reminders().unwrap(), Some(sample()));
    }

    #[test]
    fn rejects_oversized_write() {
        let (_d, ws) = ws();
        let pad = "가".repeat(REMINDERS_MAX_BYTES / 2);
        let big = json!({ "schemaVersion": 1, "reminders": [], "pad": pad });
        let err = ws.write_reminders(&big).unwrap_err();
        assert_eq!(err.code, "reminders_too_large");
        assert_eq!(ws.read_reminders().unwrap(), None);
    }

    #[test]
    fn corrupt_file_is_an_error_not_empty() {
        let (d, ws) = ws();
        fs::write(d.path().join(REMINDERS_FILE), b"{ broken").unwrap();
        assert!(ws.read_reminders().is_err());
        fs::write(
            d.path().join(REMINDERS_FILE),
            br#"{"schemaVersion":1,"reminders":"x"}"#,
        )
        .unwrap();
        let err = ws.read_reminders().unwrap_err();
        assert_eq!(err.code, "invalid_reminders");
    }
}
