import { toast } from "@/components/ui/toast";
import { frontMatterPref } from "@/features/export/prefs";
import { buildWorkspaceExport } from "@/features/export/workspace";
import { metaStore } from "@/features/meta";
import { loadEmojiTable } from "@/lib/emoji/table";
import { pagesStore } from "@/features/pages";
import { StorageError, type Storage } from "@/lib/storage";
import { getStorage } from "@/lib/storage/default";
import { msg } from "@/lib/i18n";

/** 지역 날짜 YYYY-MM-DD (폴더 이름에 쓴다) */
function todayKey(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/**
 * 워크스페이스 전체 Markdown 내보내기 (DATA-10). 목록은 features/export/workspace가 만들고,
 * 폴더 고르기와 쓰기는 Rust가 한다. 끝나면 "폴더 열기"를 단 토스트를 띄운다.
 */
export async function exportWorkspaceMarkdown(storage: Storage = getStorage()): Promise<void> {
  // 모든 문서의 본문을 써야 한다 (SYS-10, ADR-022)
  await pagesStore.getState().ensureAllBodies();
  // 이모지 노드를 글자로 쓰려면 이모지 표가 있어야 한다 (지연 로딩, SYS-11)
  await loadEmojiTable().catch(() => null);
  const meta = metaStore.getState().meta;
  const plan = buildWorkspaceExport({
    pages: Object.values(pagesStore.getState().pages),
    order: meta?.order ?? {},
    workspaceName: meta?.name ?? "",
    date: todayKey(),
    frontMatter: frontMatterPref(),
  });
  if (plan.documents === 0) {
    toast(msg().settings.exportWorkspace.noDocs);
    return;
  }
  let report;
  try {
    report = await storage.exportWorkspaceMarkdown(plan.manifest);
  } catch (e) {
    toast(msg().settings.exportWorkspace.failed, {
      description: e instanceof StorageError ? e.message : undefined,
    });
    return;
  }
  if (!report) return;
  const failed = report.failed.length;
  toast(msg().settings.exportWorkspace.exported(plan.documents), {
    description: failed
      ? msg().settings.exportWorkspace.partialFail(
          failed,
          report.failed.slice(0, 3).join(", "),
          failed > 3,
        )
      : report.folder,
    action: {
      label: msg().settings.exportWorkspace.openFolder,
      onClick: () =>
        void storage
          .revealWorkspaceExport()
          .catch(() => toast.error(msg().settings.data.openFolderFail)),
    },
  });
}
