import type { IconUpload } from "@/components/page/page-header";
import { assetErrorMessage, fetchImage, pickImage, saveImageFile } from "@/features/assets";
import { pagesStore } from "@/features/pages";
import { sessionStore, useSession } from "@/features/session";
import { imageValue } from "@/lib/page-icon";
import type { Page } from "@/lib/storage";

/** 저장 실패를 안내 문구가 담긴 Error로 */
const explain = <T>(job: Promise<T>): Promise<T> =>
  job.catch((e: unknown) => Promise.reject(new Error(assetErrorMessage(e))));

/**
 * PG-PageHeader 아이콘 props (PAGE-10) — 고른 값 저장, 최근 목록, 업로드(그 페이지의 assets/로).
 */
export function usePageIconProps(page: Page) {
  const recentIcons = useSession((s) => s.recentIcons);
  const upload: IconUpload = {
    browse: () => explain(pickImage(page.id)).then((p) => (p ? imageValue(p) : null)),
    file: (f) => explain(saveImageFile(page.id, f)).then(imageValue),
    link: (url) => explain(fetchImage(page.id, url)).then(imageValue),
  };
  return {
    icon: page.icon ?? undefined,
    onIconChange: (icon: string | undefined) => {
      pagesStore.getState().update(page.id, { icon: icon ?? null });
      if (icon) sessionStore.getState().pushRecentIcon(icon);
    },
    recentIcons,
    iconUpload: upload,
  };
}
