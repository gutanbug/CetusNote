# Changelog

All notable changes to Cetus Note are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Reminder alerts: when CetusNote is in the background, a due reminder also opens the quick input window as an alert panel (without activating the app), and the menu bar lists up to three upcoming alarms under the timer line. (SYS-16)
- Collection tables can pin columns: the column header menu has 「Pin up to here」 and 「Unpin」, so the title and the first N property columns stay visible while scrolling sideways. (COLL-02)
- Reminders view: a 「Reminders」 sidebar item (badge = today's and overdue reminders) opens a list grouped into running timers, overdue, today, tomorrow, this week, later, repeating and recently done. Each row opens its page or quick note and can be snoozed (10 min, 1 hour, tomorrow 9:00), completed, stopped (timers) or deleted. Arrow keys move between rows. The command palette has 「Show reminders」. (SYS-16)
- Quick-note reminders: each quick note has a bell to set a reminder, and its next reminder time shows under the note. The page menu has a 「Reminder…」 item that opens the same picker as the top-bar bell. A reminder that fires while the window is in use opens the due dialog (snooze, done, open) instead of an OS notification. Opening a quick-note reminder from the dialog reveals and highlights that note. (SYS-16, QN-03)
- Fixed: saving the main window no longer overwrites quick notes added by the quick-input window, and notes deleted in the main window stay deleted. (QN-03)
- Page reminders: a bell button in the page top bar opens a picker to set an alarm (natural language, quick times, 25/50-minute timers, date and time with daily, weekday, weekly or monthly repeat) and lists and removes the page's reminders. A dot marks pages with active reminders. (SYS-16)
- Reminder foundation: alarms and timers are stored per workspace in `reminders.json`, with repeat rules (daily, weekdays, weekly, monthly), snooze, and a parser that reads time phrases in Korean and English from a quick-input sentence. The scheduler and the reminder UI are not connected yet. (SYS-16)
- Reminders are now scheduled: due reminders send an OS notification (or an in-app dialog when notifications are off), reminders missed while the app was closed are listed on the next start, and the due dialog offers 10 min, 1 hour, tomorrow 9:00, done, and open. Reminders are included in workspace backups. (SYS-16)
- Menu bar residency: closing the window keeps CetusNote in the menu bar (on by default; Settings can turn it off). The menu bar item offers Quick Input, Open CetusNote and Quit. Quit with ⌘Q as before. (SYS-15)
- Quick input window: a global shortcut (⌥⇧Space by default, changeable in Settings) opens a small floating window at the top of the screen. Enter saves a quick note, ⌘Enter saves a new page, and a time phrase (for example "30분 뒤", "내일 9시") shows as a removable chip that becomes a reminder. The alarm button offers quick times, timers and repeats; typing shows up to six matching pages (↑/↓ and Enter to open). Running timers and upcoming reminders show when the input is empty. (QN-03, SYS-16)
- Launch at login (off by default) in Settings. (SYS-15)
- Settings › General › 빠른 입력 · 메뉴 막대 gathers the menu bar, launch-at-login, a quick input shortcut recorder (⌘Space and ⌥Space are refused), and an optional double-tap of ⌃, ⇧ or ⌘ (macOS, needs Accessibility permission). (SYS-15, QN-03)
- A running timer's remaining time shows next to the menu bar icon and in the menu's top line (mm:ss, or h:mm:ss past an hour). (SYS-16)
- Quick input: ⌥Enter attaches the chip's reminder to the selected page from the keyboard, the same as the bell button. (QN-03)
- Opening a page from the quick input or a due reminder brings the hidden main window forward first. (QN-03, SYS-16)
- Calendar: drag a record bar to move its dates (Esc cancels), drag its left or right edge to change only the start or due date, drag across empty days to create a record for that range, Alt+←/→ and Alt+Shift+←/→ on a focused bar, and a Week view next to Month. (COLL-04)
- Collection start date: a built-in 시작/Start property next to Due. The calendar draws each record from its start to its due date as connected bars across weeks, with overlapping bars in separate rows and a "+N" overflow; a record with only one date shows as a single-day bar. Existing pages open unchanged. (COLL-01, COLL-04)
- English interface: Settings › General › Language (System, 한국어, English). Menus, dialogs, toasts, dates and native file dialogs follow the language; slash commands, the command palette and icon search match both Korean and English keywords. (SYS-14)
- Calculation lines: end a line with `=` to see its result, then press Tab to insert it. Name values (`rent = 650,000원`) and use them below; works with won/dollar amounts, percentages, durations, dates, and running totals.
- Calculation lines handle rates: `시급 10,000원 × 8시간`, `10,000원/시간 × 90분`, `월급 3,000,000원 × 6개월`. An option in Settings › Editor lines results up on the right like a receipt.
- Settings has a new Agent / MCP tab with a connection badge that shows whether an AI tool is connected to this workspace.
- Search matches Korean initials mixed with syllables (`회ㅇㄹ`, `ㅎ의록`), the last syllable still being typed (`회의로` finds 회의록), and page body text, in ⌘K, `@` mentions, the move dialog, tag pickers and the sidebar type-ahead. Exact title matches rank above initial-based ones.
- Table view: drag the right edge of any column header, including Title, to resize it. Widths are saved per collection; double-click resets a column, and ←/→ resize from the keyboard. Long values clip inside their cells, with the full value on hover. Existing pages open unchanged. (COLL-02)

### Changed

- The quick input bar now appears over whatever app is in front, without bringing CetusNote or its main window forward (macOS: a non-activating panel). It shows on the screen with the cursor, centered horizontally, with its input line a quarter of the screen height above the bottom edge of the usable area. It also shows over full-screen apps and on every Space. (QN-03)
- Board cards keep their property row on one line. Chips that do not fit collapse into a "+N" chip whose tooltip lists the hidden values, and the date always stays visible. (COLL-03)
- Startup loads about 500 kB less: the full emoji list is now fetched the first time emoji are needed (`:` menu, typed emoji, export) instead of at launch. Saved pages and emoji output are unchanged.
- MCP Markdown now also handles images, attachments, subpages, table of contents and emoji like the app. Workspace images and attachments come back as image and attachment blocks, and page links become subpages or mentions when the page exists.
- MCP Markdown now matches the app export for toggles, toggle headings, columns, callouts, tables, math, date chips and page links, both when reading pages and when writing them.
- The math renderer (KaTeX) loads only when a page with equations is shown, so the app starts with less code. Equations show their LaTeX source in a muted style for a moment until it loads.
- Property list: reorder properties by dragging the grip handle, or focus it and press Alt+Up or Alt+Down; the ▲/▼ buttons are gone.

- Sort and filter are now saved per view (table, board, calendar), and the toolbar shows the current view's settings. Existing settings are copied to all three views. (COLL-06)
- Page files now use schema 10. Versions of Cetus Note before this one cannot open pages saved by this version.

### Fixed

- Quick input (QN-03): the shortcut shows only the quick panel. CetusNote stays in the background, a hidden app stays hidden, and the main window no longer comes forward when the panel closes.
- Quick input (QN-03): pressing the shortcut no longer crashes the app (the panel plugin was not registered), and the quick window gets its permissions in development builds.
- Quick notes written from the quick input window are appended by the backend in one step, so they are no longer lost when the main window saves workspace settings at the same time. (QN-03)
- Switching workspaces saves pending reminders to the old workspace before the switch. (SYS-16)
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
