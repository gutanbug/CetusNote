import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IMPORT_APPS, type ImportAppId } from "@/features/import/apps/pipeline";
import { importFromApp } from "./import-apps";
import { closeImportAppPicker, useImportAppPicker } from "./import-app-picker";

/** 다른 앱에서 가져오기 (DATA-11): 앱과 zip·폴더를 고른다. 메인 화면에 하나만 둔다 */
export function ImportAppDialog() {
  const open = useImportAppPicker((s) => s.open);
  const pick = (app: ImportAppId, kind: "zip" | "folder") => {
    closeImportAppPicker();
    void importFromApp(app, kind);
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && closeImportAppPicker()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>다른 앱에서 가져오기</DialogTitle>
          <DialogDescription>
            내보낸 파일이 있는 앱을 고르고, zip 파일이나 폴더를 골라 주세요.
          </DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-3">
          {IMPORT_APPS.map((app) => (
            <li key={app.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-ui">{app.label}</div>
                <div className="text-caption text-secondary">{app.hint}</div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="secondary" size="sm" onClick={() => pick(app.id, "zip")}>
                  zip 파일
                </Button>
                <Button variant="secondary" size="sm" onClick={() => pick(app.id, "folder")}>
                  폴더
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
