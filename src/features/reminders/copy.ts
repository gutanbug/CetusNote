/** 날짜 알림 안내 문구 (한국어) */
export const REMINDER_COPY = {
  permissionExplain: "날짜 알림을 받으려면 알림을 허용해 주세요. 앱이 켜져 있을 때만 울려요.",
  permissionDenied: "알림이 꺼져 있어요. 시스템 설정에서 Cetus Note 알림을 켜면 받을 수 있어요.",
  fallback: "알림을 보내지 못해 앱 안에서 알려 드려요",
  allowButton: "알림 허용",
  missedTitle: (count: number) => `놓친 알림 ${count}개`,
  untitled: "제목 없음",
} as const;
