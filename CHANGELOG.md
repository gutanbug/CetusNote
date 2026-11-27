# Changelog

All notable changes to Cetus Note are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Calculation lines: end a line with `=` to see its result, then press Tab to insert it. Name values (`rent = 650,000원`) and use them below; works with won/dollar amounts, percentages, durations, dates, and running totals.
- Settings has a new Agent / MCP tab with a connection badge that shows whether an AI tool is connected to this workspace.

### Fixed

- Updating always installs the newest release, even when a newer one came out after the app last checked.

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
