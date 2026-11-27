# Changelog

All notable changes to Cetus Note are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Calendar: drag a record bar to move its dates (Esc cancels), drag its left or right edge to change only the start or due date, drag across empty days to create a record for that range, Alt+←/→ and Alt+Shift+←/→ on a focused bar, and a Week view next to Month. (COLL-04)
- Collection start date: a built-in 시작/Start property next to Due. The calendar draws each record from its start to its due date as connected bars across weeks, with overlapping bars in separate rows and a "+N" overflow; a record with only one date shows as a single-day bar. Existing pages open unchanged. (COLL-01, COLL-04)
- English interface: Settings › General › Language (System, 한국어, English). Menus, dialogs, toasts, dates and native file dialogs follow the language; slash commands, the command palette and icon search match both Korean and English keywords. (SYS-14)
- Calculation lines: end a line with `=` to see its result, then press Tab to insert it. Name values (`rent = 650,000원`) and use them below; works with won/dollar amounts, percentages, durations, dates, and running totals.
- Calculation lines handle rates: `시급 10,000원 × 8시간`, `10,000원/시간 × 90분`, `월급 3,000,000원 × 6개월`. An option in Settings › Editor lines results up on the right like a receipt.
- Settings has a new Agent / MCP tab with a connection badge that shows whether an AI tool is connected to this workspace.
- Search matches Korean initials mixed with syllables (`회ㅇㄹ`, `ㅎ의록`), the last syllable still being typed (`회의로` finds 회의록), and page body text, in ⌘K, `@` mentions, the move dialog, tag pickers and the sidebar type-ahead. Exact title matches rank above initial-based ones.
- Table view: drag the right edge of any column header, including Title, to resize it. Widths are saved per collection; double-click resets a column, and ←/→ resize from the keyboard. Long values clip inside their cells, with the full value on hover. Existing pages open unchanged. (COLL-02)

### Changed

- Board cards keep their property row on one line. Chips that do not fit collapse into a "+N" chip whose tooltip lists the hidden values, and the date always stays visible. (COLL-03)
- Startup loads about 500 kB less: the full emoji list is now fetched the first time emoji are needed (`:` menu, typed emoji, export) instead of at launch. Saved pages and emoji output are unchanged.
- MCP Markdown now also handles images, attachments, subpages, table of contents and emoji like the app. Workspace images and attachments come back as image and attachment blocks, and page links become subpages or mentions when the page exists.
- MCP Markdown now matches the app export for toggles, toggle headings, columns, callouts, tables, math, date chips and page links, both when reading pages and when writing them.
- The math renderer (KaTeX) loads only when a page with equations is shown, so the app starts with less code. Equations show their LaTeX source in a muted style for a moment until it loads.
- Property list: reorder properties by dragging the grip handle, or focus it and press Alt+Up or Alt+Down; the ▲/▼ buttons are gone.

### Fixed

- Board cards keep their properties (date, tags, owner) on one line. Long tags shrink and cut off, and an overdue date no longer adds a word that makes one card's row wrap differently from the next. Overdue dates keep their red icon, and the "overdue" word stays for screen readers. (COLL-03)
- Table view keeps the title column at a fixed width, so long titles no longer push the other columns. Long titles are cut with an ellipsis, and the full title shows on hover. (COLL-02)
- Long pages open faster: code blocks with abbreviated languages (`ts`, `py`) are saved with the list name when the page loads, so opening no longer runs a fix-up pass over every block.
- Slash commands such as Callout now work inside lists, quotes, toggles and other blocks.
- Updating always installs the newest release, even when a newer one came out after the app last checked.
- Markdown shortcuts: inside list items, task items, and other places where the first line can't change in place, block shortcuts (`#`, `-`, `1.`, `[ ]`, `>`, `>>`, `:::`, code fences, `$$$`) now turn the item into the block instead of leaving literal text or a broken structure.
- Typing Korean on a calculation line no longer risks interrupting the input method: results stay put while a syllable is being composed and update when it is done.
- Picking a block command such as Callout on an empty list item turns the item into that block instead of leaving an empty bullet. `---` inside a list item makes a divider below the list.
- Inline math typed as `$$x$$` works again.
- Inline marks (`**bold**`, `*italic*`, `~~strike~~`, `` `code` ``, `==highlight==`) now apply when they directly follow Korean text, such as `가**나**다`.

## [0.1.7] - 2026-11-27

### Added

- Open the release notes on GitHub from the update notice, the update row in Settings, and the What's new dialog.
- Export a collection to CSV exactly as the current view shows it, or with all records.
- A folder can't be opened by two Cetus Note windows at once, to protect against conflicting saves.

### Changed

- Typing is faster, especially in long pages: the editor no longer re-renders the sidebar, dialogs and the whole document on every keystroke.
- Large workspaces open faster the first time, and the app loads less code at startup.
- Long pages with many code blocks open much faster the first time.
- Faster MCP search on large workspaces.
- Folders can now be placed inside pages.
- Evernote import uses less memory on large notebooks, because each file is read and converted before the next one.

### Fixed

- An edit typed while switching folders is no longer saved into the newly opened folder.
- The update notice can now be closed without opening the release page.
- Reopening the same folder no longer marks every page as changed.
- Toggle headings, math and dates keep their form when exporting to Markdown and importing back.
- Column layouts keep their columns and widths when exporting to Markdown and importing back.
- Switching folders no longer asks about unsaved changes when nothing was edited.

## [0.1.6] - 2026-11-26

### Added

- Page body width can inherit from the page, its folder, or the global setting.
- An MCP server mode lets AI tools connect to your notes (run the app with `--mcp`).
- Import Evernote (ENEX) notebooks as folders and notes.
- Export collection records to CSV from the collection menu.
- Markdown export copies images and attachments into an `assets/` folder.
- Markdown export can add YAML front matter, and callouts survive a Markdown round trip.

### Changed

- Faster page tree updates and MCP search on large workspaces.
- Pages no longer get re-saved when you only open them.

### Fixed

- Pending edits are saved before you quit with ⌘Q.
- External edits are kept instead of being overwritten by autosave.
- Column blocks show a live drag preview.
- Front matter tag lists are read correctly on import.
- Markdown export caps file and folder names at 252 bytes.

## [0.1.5] - 2026-11-25

### Added

- File attachment, PDF, and media blocks, plus an emoji picker.
- Date reminders with a scheduler and system notifications.
- Subpage and breadcrumb blocks.
- Collapsible toggle headings and a 2–4 column layout block.
- Date chip with a calendar popover.

### Fixed

- Accessibility and tooltip fixes across the editor blocks and slash menu.

## [0.1.4] - 2026-11-24

### Fixed

- Collapsed toggles open when you jump to them from the table of contents.
- Code blocks are highlighted again after an edit changes the block structure.
- Recent workspace names update when you rename a workspace.
- Pending saves are flushed before switching workspaces.
- The update download toast tracks progress to the end.
- Sidebar tree scrolls with the mouse wheel and returns focus after the row menu closes.

## [0.1.3] - 2026-11-24

### Added

- Table of contents block, also included in Markdown export.
- Select all in a table cell, then the whole document.

### Changed

- Faster large collections and sidebars, with lighter code block updates.

### Fixed

- The app shell stays fixed to the window.

## [0.1.2] - 2026-11-24

### Added

- Windows and Linux builds.
- An update toast that stays until you install or close it.
- Export guides for common apps in the import/export dialog.

### Fixed

- Many small UI fixes: dialog focus, empty states, hit areas, and tooltips.

## [0.1.1] - 2026-11-23

### Added

- Automatic update checks with signed updates and a "Check for updates" command.
- Import text, HTML, Word (.docx), PDF, and Markdown files as pages.
- PDF export preview inside the app, with its own zoom controls.
- Choose an app icon (white or black) in Appearance settings.
- Grouped data settings for backup, Markdown, and templates.

### Changed

- The home screen and empty state show the constellation mark.

## [0.1.0] - 2026-11-23

Initial development version. Not released publicly.

[Unreleased]: https://github.com/gutanbug/CetusNote/compare/v0.1.7...HEAD
[0.1.7]: https://github.com/gutanbug/CetusNote/compare/v0.1.6...v0.1.7
[0.1.6]: https://github.com/gutanbug/CetusNote/compare/v0.1.5...v0.1.6
[0.1.5]: https://github.com/gutanbug/CetusNote/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/gutanbug/CetusNote/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/gutanbug/CetusNote/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/gutanbug/CetusNote/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/gutanbug/CetusNote/releases/tag/v0.1.1
