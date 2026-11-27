import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CHANGELOG_TEXT,
  extractSection,
  parseBlocks,
  parseInline,
  releaseUrl,
  useWhatsNew,
  whatsNewStore,
  type Block,
  type Inline,
} from "@/features/release-notes";
import { openLink } from "@/lib/storage/open-link";
import { useMessages } from "@/lib/i18n";

function InlineText({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((part, i) => {
        switch (part.kind) {
          case "bold":
            return (
              <strong key={i} className="font-semibold text-primary">
                {part.text}
              </strong>
            );
          case "code":
            return (
              <code key={i} className="rounded-sm bg-hover px-1 font-mono text-caption">
                {part.text}
              </code>
            );
          case "link":
            return (
              <a
                key={i}
                href={part.href}
                className="text-accent underline underline-offset-2 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent focus-visible:outline-solid"
                onClick={(e) => {
                  e.preventDefault();
                  void openLink(part.href);
                }}
              >
                {part.text}
              </a>
            );
          default:
            return <span key={i}>{part.text}</span>;
        }
      })}
    </>
  );
}

function BlockView({ block }: { block: Block }) {
  if (block.kind === "heading") {
    return <h3 className="pt-2 text-ui font-semibold text-primary first:pt-0">{block.text}</h3>;
  }
  if (block.kind === "list") {
    return (
      <ul className="grid list-disc gap-1 pl-5 text-ui text-secondary marker:text-tertiary">
        {block.items.map((item, i) => (
          <li key={i}>
            <InlineText parts={parseInline(item)} />
          </li>
        ))}
      </ul>
    );
  }
  return (
    <p className="text-ui text-secondary">
      <InlineText parts={parseInline(block.text)} />
    </p>
  );
}

/** 업데이트 뒤 또는 「릴리스 노트 보기」로 여는 대화상자. 내용은 빌드에 묶인 CHANGELOG.md다 (SYS-12) */
export function WhatsNewDialog() {
  const m = useMessages();
  const version = useWhatsNew((s) => s.version);
  const blocks = useMemo(() => {
    if (!version) return [];
    const section = extractSection(CHANGELOG_TEXT, version);
    return section ? parseBlocks(section) : [];
  }, [version]);
  const close = () => whatsNewStore.getState().close();

  return (
    <Dialog open={version !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
        <DialogHeader>
          <DialogTitle>{m.settings.whatsNew.title(version ?? "")}</DialogTitle>
          <DialogDescription>{m.settings.whatsNew.desc}</DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 content-start gap-3 overflow-y-auto pr-1">
          {blocks.map((block, i) => (
            <BlockView key={i} block={block} />
          ))}
        </div>
        <DialogFooter>
          {version ? (
            <Button
              variant="ghost"
              className="mr-auto"
              onClick={() => void openLink(releaseUrl(version))}
            >
              {m.settings.whatsNew.github}
            </Button>
          ) : null}
          <Button variant="primary" onClick={close}>
            {m.settings.common.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
