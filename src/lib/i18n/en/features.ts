import type { Messages } from "../ko";

/** English strings — features area (SYS-14). Same keys as ../ko/features.ts */
const rel = (n: number, unit: Intl.RelativeTimeFormatUnit) =>
  new Intl.RelativeTimeFormat("en-US", { numeric: "always" }).format(n, unit);

export const features: Messages["features"] = {
  app: {
    autoBackupFailed: "Couldn't create an automatic backup. Check Settings → Data.",
    externalChangesKept: "Changes made elsewhere were saved to version history.",
    viewHistory: "View version history",
    externalPagesChanged:
      "Some pages changed elsewhere. Your edits here were kept, and the other changes are in version history.",
    externalReadErrors: (n: number) =>
      `Couldn't read ${n} ${n === 1 ? "file" : "files"} changed outside the app.`,
    quitFailed: "Couldn't quit the app. Try again.",
    quitBlockedUnsaved: "Some changes aren't saved. The app didn't quit.",
    quitAnyway: "Quit anyway",
    closeBlockedUnsaved: "Some changes aren't saved. The window didn't close.",
    closeAnyway: "Close anyway",
  },
  workspace: {
    switchBlockedUnsaved: "The folder wasn't changed because some changes aren't saved",
    switchBlockedUnsavedRetry:
      "The folder wasn't changed because some changes aren't saved. Try again in a moment.",
    notWritable: "Can't write to this folder. Choose another folder.",
    noSpace: "The disk is out of space. Free up some space and try again.",
    notFound: "Folder not found. Choose another folder.",
    nameTaken: "A folder with the same name already exists there. Choose another name or location.",
    inUse: "Another Cetus Note window is using this folder. Close that window and open it again.",
    invalidName: "This name can't be used for a folder. Remove / \\ : and a leading dot (.).",
    openFailed: "Couldn't open the folder. Try again.",
    missingFolder: (name: string) =>
      `“${name}” folder not found. Remove it from the list or open another folder.`,
  },
  pages: {
    onlyPagesInCollection: "Only pages can go inside a collection",
    permanentDeleteNoBody: "Couldn't read the page body, so it wasn't permanently deleted",
    trashSaveFailed: "Couldn't save the move to trash",
    imageCopySaveFailed: "Couldn't save the image copy",
    saveSkippedOnSwitch: "Unsaved changes were left out because the workspace changed",
    statsEmpty: "No text yet",
    statsSummary: (chars: string, words: string, minutes: number) =>
      `Characters ${chars} · Words ${words} · About ${minutes} min`,
    untitledFolder: "Untitled folder",
    untitledCollection: "Untitled collection",
  },
  search: { bodyReadFailed: "Search index: couldn't read the page body" },
  backup: {
    fileName: (safe: string, date: string) => `${safe} backup ${date}.zip`,
    notBackupFile: "This isn't a Cetus Note backup file, or it's damaged.",
    entryTooLarge: "A file in the backup is too large to extract.",
    insideWorkspace: "Save it outside the workspace folder.",
    notWritable: "Can't write to this folder. Choose another folder.",
    noSpace: "The disk is out of space.",
    failed: "Couldn't back up. Try again.",
  },
  assets: {
    unsupportedImage: "Only PNG, JPEG, GIF, WebP, and AVIF images can be added.",
    tooLarge: "Images larger than 25 MB can't be added.",
    fetchFailed: "Couldn't fetch the image from the link. Check the address.",
    saveFailed: "Couldn't save the image.",
  },
  pdf: {
    noCanvas: "Couldn't draw the preview image",
    pngFailed: "Couldn't convert the page image to PNG",
  },
  releaseNotes: {
    missing: (v: string | null) =>
      v ? `No release notes for version ${v}` : "No release notes for this version",
  },
  dates: {
    today: "Today",
    tomorrow: "Tomorrow",
    yesterday: "Yesterday",
    daysLater: (n: number) => rel(n, "day"),
    justNow: "just now",
    minutesAgo: (n: number) => rel(-n, "minute"),
    hoursAgo: (n: number) => rel(-n, "hour"),
    daysAgo: (n: number) => rel(-n, "day"),
    absoluteDay: (date: Date, withYear: boolean) =>
      `${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}) }).format(date)} (${new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date)})`,
  },
  history: {
    justNow: "Just now",
    dayLabel: (date: Date, sameYear: boolean) =>
      new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        ...(sameYear ? {} : { year: "numeric" }),
      }).format(date),
    chars: (n: number) => `${n.toLocaleString("en-US")} ${n === 1 ? "character" : "characters"}`,
  },
  reminder: {
    none: "None",
    morning: "9:00 AM on the day",
    custom: "Custom time",
    before10: "10 minutes before",
    before60: "1 hour before",
    before1440: "1 day before",
  },
  reminders: {
    permissionExplain:
      "Allow notifications to get date reminders. They only ring while the app is open.",
    permissionDenied:
      "Notifications are off. Turn on Cetus Note notifications in System Settings to receive them.",
    fallback: "Couldn't send a notification, so we'll let you know inside the app",
    allowButton: "Allow notifications",
    missedTitle: (count: number) => `${count} missed ${count === 1 ? "reminder" : "reminders"}`,
    untitled: "Untitled",
  },
  updater: {
    downloading: "Downloading…",
    finishing: "Installing and reopening…",
    downloadingPercent: (p: number) => `Downloading ${p}%`,
    checking: "Checking for a new version…",
    checkingAction: "Checking…",
    latest: "You're up to date",
    checkAction: "Check for updates",
    newVersion: (v: string) => `Version ${v} is available`,
    installAction: "Update",
    retryAction: "Try again",
    checkFailed: "Couldn't check for updates.",
    checkError: "Couldn't check for updates. Check your internet connection.",
    installError: "Couldn't download the update. Try again.",
    relaunchError: "The update is installed. Please reopen the app yourself.",
    saveBeforeRestart:
      "The update was postponed because some changes aren't saved. Save them and try again.",
    progressLabel: "Download progress",
    close: "Close",
    releaseLink: "View release",
    latestToast: (v: string) => `You're up to date (${v})`,
    noUpdate: "No update has been checked",
  },
  export: {
    yes: "Yes",
    no: "No",
    columns: { title: "Title", status: "Status", assignee: "Assignee", due: "Due", tags: "Tags" },
    fallback: {
      collection: "Collection",
      image: "Image",
      attachment: "Attachment",
      subpage: "Subpage",
    },
  },
  import: {
    propertyName: (i: number) => `Property ${i}`,
    affineOriginal:
      "AFFiNE original files can't be imported. Export them to Markdown in AFFiNE, then choose the export again",
    evernoteUseEnex: "For Evernote files, use “Choose ENEX files”",
    notFound: {
      notion:
        "Couldn't find any pages in the Notion export. Check that it was exported as Markdown & CSV",
      obsidian: "Couldn't find any notes (.md) in the Obsidian vault. Choose the vault folder",
      appflowy:
        "Couldn't find any pages in the AppFlowy export. Check that it was exported as Markdown or HTML",
      affine:
        "Couldn't find any pages in the AFFiNE export. Check that it was exported as Markdown",
      evernote:
        "Couldn't find any notes in the Evernote export. Check that it was exported in ENEX format",
    },
    failedToRead: "Couldn't import the page",
    importedOne: (title: string) => `Imported “${title}”`,
    importedMany: (n: number) => `Imported ${n} pages`,
    partialOne: (title: string, failed: number) =>
      `Imported “${title}”, but ${failed} couldn't be read`,
    partialMany: (n: number, failed: number) =>
      `Imported ${n} pages, but ${failed} couldn't be read`,
    attachmentFile: "Attachment",
    skipFormat: "(couldn't read the formatting, so only the text was imported)",
    skipMissingImages: (n: number) =>
      `(${n} ${n === 1 ? "image is" : "images are"} missing originals)`,
    skipEnexFormat: "(couldn't read ENEX format)",
    enexReadError: "Couldn't read the Evernote file. Check that it was exported in ENEX format",
    notebookFallback: "Evernote notebook",
    encryptedNote: "Encrypted content wasn't imported.",
    guides: {
      notion: {
        hint: "Markdown & CSV export as a zip",
        gets: [
          "Page content (headings, lists, tables, code, images) and subpage structure",
          "Databases (CSV) move over as collections",
        ],
        misses: [
          "Relation, formula and rollup columns (not moved as values)",
          "Comments and version history",
        ],
        steps: [
          "Open the top-level page you want to import and click the ••• (More) button at the top right.",
          "In the ••• menu, open 「More」 and click 「Export」.",
          "Choose 「Markdown & CSV」 as the format and turn on 「Include subpages」.",
          "Click 「Export」, then pick the zip file you receive as it is. Don't unzip it.",
        ],
        note: "To export the whole workspace, go to Settings → General → 「Export all workspace content」. Preparing it can take a while, and the link sent by email expires after 7 days.",
      },
      obsidian: {
        hint: "Vault folder or zip",
        gets: [
          "Notes (.md), front matter (title, tags, aliases) and #tags",
          "Wikilinks, aliases, images (![[image]]) and callouts (> [!type])",
        ],
        misses: ["Canvas (.canvas) files and plugin data", "Images outside the vault"],
        steps: [
          "No export needed. Your notes stay in the vault folder as they are.",
          "Click 「Folder」 and choose the vault folder. The .obsidian folder inside is skipped.",
          "If you zipped the vault, choose 「zip file」.",
        ],
      },
      appflowy: {
        hint: "Files and folders exported as Markdown or HTML",
        gets: [
          "Markdown and HTML documents and subpage structure",
          "Images (relative paths from the document) and CSV databases (as collections)",
        ],
        misses: [
          "AppFlowy's internal workspace format",
          "Relation, formula and rollup columns in databases",
        ],
        steps: [
          "For each page you want to import, click ••• (More) and choose 「Markdown」 under 「Export」. Export databases as 「CSV」.",
          "Keep the files and images you receive together in one folder. Images are found by their paths relative to the document.",
          "Click 「Folder」 and choose that folder.",
        ],
        note: "Couldn't check AppFlowy's official help. A community post (forum.appflowy.com) confirmed per-page Markdown and CSV export (2026-11-23). Menu names may differ by version.",
      },
      affine: {
        hint: "Files and folders exported as Markdown",
        gets: [
          "Markdown documents and images (index.md and the assets folder)",
          "CSV databases (as collections)",
        ],
        misses: [
          "Original files (.affine, .bs.zip) and document snapshots — export to Markdown instead",
          "Whiteboard content",
        ],
        steps: [
          "In the document menu, choose 「Markdown」 export. The share panel has the same export menu.",
          "Repeat for each document you want to import and keep them together in one folder.",
          "Click 「Folder」 and choose that folder.",
        ],
        note: "The AFFiNE official blog (v0.27.4, checked 2026-10-09) confirmed the 「Markdown」 export in the document menu. The top-level 「Export」 menu name wasn't confirmed in that post, and menu names may differ by version.",
      },
      evernote: {
        hint: "One ENEX file per notebook",
        gets: [
          "Note content (formatting, lists, tables, links) and checklists",
          "Images and attachments, tags, created and updated dates. The file name becomes the notebook folder",
        ],
        misses: [
          "Encrypted notes (only a notice is left in their place)",
          "Images without originals, sharing and comment info",
        ],
        steps: [
          "In the sidebar, right-click the notebook you want to import and choose 「Export notes…」.",
          "Choose 「ENEX」 as the format and save. Each notebook produces one .enex file.",
          "Click 「Choose ENEX files」 and pick the .enex files you received. You can select several at once.",
        ],
        note: "Menu names may differ by Evernote version. Export works only per notebook.",
      },
    },
  },
  untitled: "Untitled",
  platform: {
    revealWindows: "Show in Explorer",
    revealLinux: "Show in file manager",
    revealMac: "Show in Finder",
  },
  codeLanguage: { plain: "Plain text", shell: "Shell session", phpTemplate: "PHP template" },
  attachments: {
    fileFallback: "File",
    pdfOnly: "Only PDF files can be added.",
    mediaOnly: "Only video and audio files can be added.",
    notFound: "Couldn't find the file.",
    symlink: "Link files can't be added.",
    failed: "Couldn't attach the file.",
    tooLargeMedia: "Media file is too large (max 200 MB)",
    tooLarge: "File is too large (max 25 MB)",
  },
  templates: {
    categories: { work: "Work", journal: "Journal", study: "Study" },
    meeting: {
      name: "Meeting notes",
      description: "Attendees · Agenda · Decisions · Action items",
      title: (d: string) => `Meeting notes ${d}`,
      header: (d: string) => `Attendees: · Notes by: · Date: ${d}`,
      agenda: "Agenda",
      discussion: "Discussion",
      decisions: "Decisions",
      actionItems: "Action items",
    },
    weekly: {
      name: "Weekly review",
      description: "Wins · Blockers · Next week's plan",
      title: "Weekly review",
      wins: "Wins this week",
      blockers: "Blockers",
      nextWeek: "Plan for next week",
    },
    daily: {
      name: "Daily note",
      description: "Today's tasks · Log · Reflection",
      title: (d: string) => `Daily note ${d}`,
      today: "Today's tasks",
      log: "Log",
      reflection: "Reflection",
      reflectionPrompt: "What went well / What didn't / What to change next time",
    },
    todo: {
      name: "To-do",
      description: "Today · This week · Backlog",
      title: "To-do",
      today: "Today",
      thisWeek: "This week",
      waiting: "Backlog",
    },
    study: {
      name: "Study notes",
      description: "Summary · Example code · Key points",
      title: "Study notes",
      summary: "One-line summary",
      example: "Example code",
      remember: "Key points",
      more: "Further reading",
    },
    reading: {
      name: "Reading notes",
      description: "Source · Key claims · My take",
      title: "Reading notes",
      source: "Source",
      claims: "Key claims",
      mine: "My thoughts",
    },
  },
};
