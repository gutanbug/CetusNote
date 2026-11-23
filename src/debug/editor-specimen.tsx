import { NoteEditor, type NoteEditorProps } from "@/components/editor/note-editor";

/** 스토리·Debug 전용: 본문 폭(--content-w)에 에디터 하나를 그린다 */
export function EditorSpecimen(props: NoteEditorProps) {
  return (
    <div className="mx-auto w-full max-w-(--content-w)">
      <NoteEditor {...props} />
    </div>
  );
}
