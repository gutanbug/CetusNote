import type { Messages } from "../ko";

/** English strings — shell area (SYS-14). Same keys as ../ko/shell.ts */
export const shell: Messages["shell"] = {
  untitled: { page: "Untitled", folder: "Untitled folder", collection: "Untitled collection" },
  breadcrumb: {
    label: "Breadcrumb",
    hidden: (n) => `Hidden path, ${n} ${n === 1 ? "level" : "levels"}`,
  },
  tabs: { label: "Open tabs", newTab: "New tab" },
  tree: {
    label: "Pages",
    more: (name) => `${name} more`,
    addTo: (name) => `Add to ${name}`,
    addPageTo: (name) => `Add page to ${name}`,
    addSubpage: (name) => `Add subpage to ${name}`,
  },
  resizer: {
    label: "Resize sidebar",
    valueText: (px) => `${px}px`,
  },
  saveStatus: {
    saved: "All changes saved",
    saving: "Saving…",
    error: "Couldn't save",
    retry: "Retry",
  },
  sidebar: { label: "Sidebar", trash: "Trash" },
  tag: {
    pageCount: (n) => `${n} ${n === 1 ? "page" : "pages"}`,
    menu: (name) => `${name} tag menu`,
  },
  topBar: {
    sidebar: "Sidebar",
    outline: "Outline",
    favorite: "Favorite",
    focus: "Focus mode",
    pageMenu: "Page menu",
  },
  workspace: {
    current: "Workspace: ",
    title: "Workspaces",
    remove: "Remove from list",
    openNow: ", open now",
    newWorkspace: "New workspace…",
    openFolder: "Open another folder…",
    openFolderDetail: "Use an existing notes folder as a workspace",
  },
};
