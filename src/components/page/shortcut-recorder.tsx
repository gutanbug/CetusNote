import { useEffect, useState } from "react";
import { Kbd } from "@/components/ui/kbd";
import {
  acceleratorFromEvent,
  displayKeys,
  validateShortcut,
  type ShortcutIssue,
} from "@/lib/shortcut";
import { cn } from "@/lib/utils";

export type ShortcutRecorderLabels = {
  /** 버튼 이름 (스크린 리더) */
  aria: string;
  /** 기록 중에 보이는 문구 */
  recording: string;
  /** 조합이 없을 때 보이는 문구 */
  empty: string;
  /** 검사에 걸렸을 때 문구 */
  issue: Record<ShortcutIssue, string>;
  /** 기록 중 안내 (Esc 취소 · Backspace 기본값) */
  hint: string;
};

export type ShortcutRecorderProps = {
  /** 현재 조합 (예 "Alt+Shift+Space") */
  value: string;
  /** 기본 조합. Backspace로 되돌린다 */
  defaultValue: string;
  onChange: (accelerator: string) => void;
  labels: ShortcutRecorderLabels;
  disabled?: boolean;
  className?: string;
};

/**
 * 단축키 기록기 (QN-03). 누르면 다음 키 조합을 받는다. 수식키가 하나 이상 있어야 하고 ⌘Space·⌥Space는 막는다.
 * Esc는 취소, Backspace는 기본값으로 되돌린다. 실제 키 처리는 기록 중에만 켠다.
 */
function ShortcutRecorder({
  value,
  defaultValue,
  onChange,
  labels,
  disabled = false,
  className,
}: ShortcutRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [issue, setIssue] = useState<ShortcutIssue | null>(null);

  useEffect(() => {
    if (!recording) return;
    const stop = () => {
      setRecording(false);
      setIssue(null);
    };
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === "Escape") return stop();
      if (e.code === "Backspace") {
        onChange(defaultValue);
        return stop();
      }
      const accelerator = acceleratorFromEvent(e);
      if (!accelerator) return; // 수식키만 눌렀다: 아직 기록 중
      const problem = validateShortcut(accelerator);
      if (problem) {
        setIssue(problem);
        return;
      }
      onChange(accelerator);
      stop();
    };
    // 기록 중에는 창 전체의 키를 받는다 (단축키 자체가 다른 곳에서 먹지 않도록 capture)
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("blur", stop);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("blur", stop);
    };
  }, [recording, onChange, defaultValue]);

  const keys = displayKeys(value);

  return (
    <div className={cn("inline-flex flex-col items-start gap-1", className)}>
      <button
        type="button"
        aria-label={labels.aria}
        aria-describedby={recording ? "shortcut-recorder-hint" : undefined}
        disabled={disabled}
        onClick={() => setRecording((r) => !r)}
        className={cn(
          "inline-flex h-8 min-w-40 items-center justify-center gap-1 rounded-md border border-border bg-app px-3 text-ui text-primary",
          "hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none",
          "disabled:opacity-50",
          recording && "border-accent",
        )}
      >
        {recording ? (
          <span className="text-tertiary">{labels.recording}</span>
        ) : keys.length > 0 ? (
          <Kbd keys={keys} />
        ) : (
          <span className="text-tertiary">{labels.empty}</span>
        )}
      </button>
      {recording && (
        <span id="shortcut-recorder-hint" className="text-xs text-tertiary">
          {labels.hint}
        </span>
      )}
      {issue && (
        <span role="alert" className="text-xs text-danger">
          {labels.issue[issue]}
        </span>
      )}
    </div>
  );
}

export { ShortcutRecorder };
