import { IconButton } from "@/components/ui/icon-button";
import { formatTime } from "@/lib/attachments/format";
import { withFirstFrame } from "@/lib/attachments/media-url";
import { cn } from "@/lib/utils";
import { Maximize, Minimize, Pause, Play, Volume2, VolumeX } from "lucide-react";
import * as React from "react";
import { FileAttachment, type AttachmentActions } from "./file-attachment";

/** 재생 속도 단계 */
const RATES = [1, 1.25, 1.5, 2];
/** ← → 한 번에 옮기는 초 */
const SEEK_STEP = 5;

export type MediaPlayerProps = AttachmentActions & {
  kind: "video" | "audio";
  name: string;
  /** 워크스페이스 경로(`assets/…`) 또는 이미 웹뷰 주소 */
  src: string;
  /** 경로 → 웹뷰가 읽을 주소 (phase 2: convertFileSrc). 없으면 src를 그대로 쓴다 */
  resolveSrc?: (path: string) => string;
  size?: number;
  mime?: string;
  /** 아래에 보일 캡션 */
  caption?: string;
  missing?: boolean;
  selected?: boolean;
  editable?: boolean;
  className?: string;
};

type PlayerProps = Omit<MediaPlayerProps, "missing" | "resolveSrc" | "src"> & {
  url: string;
  onFail: () => void;
};

/** 재생 본체. url이 바뀌면 key로 새로 만든다 */
function Player({ kind, name, url, caption, selected, className, onFail }: PlayerProps) {
  const mediaRef = React.useRef<HTMLMediaElement>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = React.useState(false);
  const [time, setTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [muted, setMuted] = React.useState(false);
  const [volume, setVolume] = React.useState(1);
  const [rateIndex, setRateIndex] = React.useState(0);
  const [fullscreen, setFullscreen] = React.useState(false);
  const isVideo = kind === "video";
  const rate = RATES[rateIndex];

  React.useEffect(() => {
    if (mediaRef.current) mediaRef.current.playbackRate = rate;
  }, [rate]);

  React.useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const toggle = () => {
    const el = mediaRef.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => {});
    else el.pause();
  };
  const seek = (to: number) => {
    const el = mediaRef.current;
    if (!el || !Number.isFinite(duration) || duration <= 0) return;
    el.currentTime = Math.min(duration, Math.max(0, to));
    setTime(el.currentTime);
  };
  const seekBy = (delta: number) => seek((mediaRef.current?.currentTime ?? 0) + delta);
  const toggleMute = () => {
    const el = mediaRef.current;
    if (el) el.muted = !el.muted;
  };
  const changeVolume = (value: number) => {
    const el = mediaRef.current;
    if (!el) return;
    el.volume = value;
    el.muted = value === 0;
  };
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void rootRef.current?.requestFullscreen?.().catch(() => {});
  };

  /** 플레이어 포커스 중의 키. 버튼·입력에 포커스가 있을 때 Space는 그 요소의 동작을 따른다 */
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.altKey || e.metaKey || e.ctrlKey) return;
    const target = e.target as HTMLElement;
    const native = target.tagName === "BUTTON" || target.tagName === "INPUT";
    switch (e.key) {
      case " ":
        if (native) return;
        e.preventDefault();
        toggle();
        return;
      case "k":
      case "K":
        e.preventDefault();
        toggle();
        return;
      case "ArrowLeft":
        e.preventDefault();
        seekBy(-SEEK_STEP);
        return;
      case "ArrowRight":
        e.preventDefault();
        seekBy(SEEK_STEP);
        return;
      case "m":
      case "M":
        e.preventDefault();
        toggleMute();
        return;
      case "f":
      case "F":
        if (!isVideo) return;
        e.preventDefault();
        toggleFullscreen();
        return;
      default:
        return;
    }
  };

  // 재생 상태는 미디어 요소의 이벤트를 따른다(컨트롤은 상태만 그린다)
  const events = {
    onPlay: () => setPlaying(true),
    onPause: () => setPlaying(false),
    onEnded: () => setPlaying(false),
    onTimeUpdate: (e: React.SyntheticEvent<HTMLMediaElement>) =>
      setTime(e.currentTarget.currentTime),
    onLoadedMetadata: (e: React.SyntheticEvent<HTMLMediaElement>) =>
      setDuration(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0),
    onDurationChange: (e: React.SyntheticEvent<HTMLMediaElement>) =>
      setDuration(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0),
    onVolumeChange: (e: React.SyntheticEvent<HTMLMediaElement>) => {
      setMuted(e.currentTarget.muted);
      setVolume(e.currentTarget.volume);
    },
  };

  const shownTime = `${formatTime(time)} / ${formatTime(duration)}`;

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label={`${name} 재생기`}
      tabIndex={0}
      data-slot="media-player"
      data-kind={kind}
      data-selected={selected || undefined}
      onKeyDown={onKeyDown}
      className={cn(
        "group m-0 overflow-hidden rounded-lg border bg-elevated outline-none",
        selected ? "border-accent" : "border-line",
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent focus-visible:outline-solid",
        fullscreen && "rounded-none border-0",
        className,
      )}
    >
      {isVideo ? (
        <video
          ref={mediaRef as React.RefObject<HTMLVideoElement>}
          src={withFirstFrame(url)}
          aria-label={name}
          preload="metadata"
          playsInline
          {...events}
          onClick={toggle}
          onError={onFail}
          className="block max-h-[60vh] w-full cursor-pointer bg-inverse"
        />
      ) : (
        <audio
          ref={mediaRef as React.RefObject<HTMLAudioElement>}
          src={url}
          preload="metadata"
          {...events}
          onError={onFail}
        />
      )}
      <div className="flex items-center gap-1 px-2 py-1.5">
        <IconButton label={playing ? "일시 정지" : "재생"} shortcut="Space" onClick={toggle}>
          {playing ? <Pause strokeWidth={1.5} /> : <Play strokeWidth={1.5} />}
        </IconButton>
        <input
          type="range"
          aria-label="재생 위치"
          aria-valuetext={shownTime}
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(time, duration || 0)}
          disabled={!duration}
          onChange={(e) => seek(Number(e.target.value))}
          className="mx-1 min-w-0 flex-1 accent-accent disabled:opacity-40"
        />
        <span className="shrink-0 px-1 text-caption text-secondary tabular-nums">{shownTime}</span>
        <button
          type="button"
          aria-label={`재생 속도 ${rate}×`}
          onClick={() => setRateIndex((i) => (i + 1) % RATES.length)}
          className={cn(
            "h-6 min-w-10 shrink-0 rounded-md px-1.5 text-caption text-secondary tabular-nums",
            "hover:bg-active hover:text-primary force-hover:bg-active force-hover:text-primary",
            "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent focus-visible:outline-solid",
          )}
        >
          {rate}×
        </button>
        <IconButton label={muted ? "소리 켜기" : "음소거"} shortcut="M" onClick={toggleMute}>
          {muted || volume === 0 ? <VolumeX strokeWidth={1.5} /> : <Volume2 strokeWidth={1.5} />}
        </IconButton>
        <input
          type="range"
          aria-label="음량"
          min={0}
          max={1}
          step={0.05}
          value={muted ? 0 : volume}
          onChange={(e) => changeVolume(Number(e.target.value))}
          className="w-20 shrink-0 accent-accent"
        />
        {isVideo && (
          <IconButton
            label={fullscreen ? "전체 화면 끝내기" : "전체 화면"}
            shortcut="F"
            onClick={toggleFullscreen}
          >
            {fullscreen ? <Minimize strokeWidth={1.5} /> : <Maximize strokeWidth={1.5} />}
          </IconButton>
        )}
      </div>
      {caption && <p className="px-3 pb-2 text-caption text-tertiary">{caption}</p>}
    </div>
  );
}

/**
 * ED-MediaPlayer — 영상·소리 블록. 네이티브 `<video>`·`<audio>`를 쓰고 컨트롤은 토큰 스타일로 새로 그린다.
 * 키: Space·K 재생/정지, ← → 5초, M 음소거, F 전체 화면(영상). 재생 못 하면 파일 카드로 대체.
 */
export function MediaPlayer({ src, resolveSrc, missing = false, ...props }: MediaPlayerProps) {
  const url = resolveSrc ? resolveSrc(src) : src;
  // 실패한 주소를 기억해 두면 다른 파일로 바꿨을 때 자동으로 다시 시도한다
  const [failedUrl, setFailedUrl] = React.useState<string | null>(null);
  const failed = failedUrl === url;

  if (missing || failed) {
    return (
      <FileAttachment
        name={props.name}
        size={props.size}
        mime={props.mime}
        kind={props.kind}
        missing={missing}
        selected={props.selected}
        editable={props.editable}
        className={props.className}
        notice={missing ? undefined : "재생할 수 없어요 · 형식을 지원하지 않거나 파일이 없어요"}
        onOpen={props.onOpen}
        onReveal={props.onReveal}
        onDownload={props.onDownload}
        onReplace={props.onReplace}
        onRemove={props.onRemove}
      />
    );
  }

  return <Player key={url} {...props} url={url} onFail={() => setFailedUrl(url)} />;
}
