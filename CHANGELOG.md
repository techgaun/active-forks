# Changelog

Notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
since the project is deployed continuously from `main`, entries are grouped by date
rather than version.

## 2026-08-28

### Added

- CI workflow that publishes the browser extension to the Chrome Web Store
  and Firefox Add-ons on merge to `main` when `extension/` changed and the
  manifest version was bumped; store setup and required secrets are
  documented in `extension/PUBLISHING.md`
  ([#107](https://github.com/techgaun/active-forks/pull/107)).

- A cross-browser (Chrome/Edge/Firefox, Manifest V3) extension in
  `extension/` ([#106](https://github.com/techgaun/active-forks/pull/106)):
  a toolbar popup previewing the current repository's top 10 forks (sortable
  by stars or creation date) with a link to the full view, and a context-menu
  entry on GitHub pages and GitHub repository links.

- Non-zero Ahead/Behind counts link to GitHub's compare view, showing the
  fork's unique commits (Ahead) or the upstream commits the fork lacks
  (Behind) ([#103](https://github.com/techgaun/active-forks/pull/103)).
- The searched repository itself is shown as the table's first row with an
  "upstream" badge, as a baseline to compare forks against
  ([#103](https://github.com/techgaun/active-forks/pull/103)).

- Ahead/Behind columns showing how many commits each fork's default branch is
  ahead of / behind the upstream default branch, computed via the GitHub
  compare API ([#100](https://github.com/techgaun/active-forks/pull/100)).
  Lookups run when a personal access token is configured, and only for rows on
  the currently visible table page — paging, sorting, or filtering fetches
  more on demand, and sorting by Ahead/Behind fetches counts for all filtered
  rows so the sort order is correct. Renamed forks are re-resolved by their
  immutable repository id and still compared.
- Optional GitHub personal access token field below the search box
  ([#99](https://github.com/techgaun/active-forks/pull/99)). The token is
  stored only in the browser's `localStorage` and sent only to
  `api.github.com`; it raises the API rate limit from 60 to 5,000
  requests/hour.
- Pagination of the forks listing beyond the first 100 forks via `Link`
  response headers — up to 400 forks without a token and 3,000 with one, with
  a notice when results are truncated
  ([#99](https://github.com/techgaun/active-forks/pull/99)).
- A changelog (this file).

### Changed

- The Size column is now rendered in human-readable units (kB/MB/GB/TB);
  sorting and filtering still use the raw value
  ([#101](https://github.com/techgaun/active-forks/pull/101)).
- The repository input accepts pasted GitHub URLs with extra path segments
  (`/tree/main`, `/issues`, …) and trailing `.git`
  ([#101](https://github.com/techgaun/active-forks/pull/101)).
- Dark mode now defaults to the operating system's color scheme until the
  toggle is used explicitly
  ([#101](https://github.com/techgaun/active-forks/pull/101)).
- Avatar images are lazy-loaded
  ([#101](https://github.com/techgaun/active-forks/pull/101)).
- Submitting a new search cancels the previous one, and the search button's
  spinner is shown while fetching
  ([#99](https://github.com/techgaun/active-forks/pull/99)).

### Fixed

- Alerts could not be dismissed since the Bootstrap 5 upgrade (stale
  Bootstrap 4 close-button markup)
  ([#99](https://github.com/techgaun/active-forks/pull/99), fixes
  [#96](https://github.com/techgaun/active-forks/issues/96)).
- The table failed to render when the forks list contained a fork whose owner
  account had been deleted
  ([#99](https://github.com/techgaun/active-forks/pull/99)).
- The dark-mode toggle's pressed state was out of sync with the restored
  theme on page load, and clicks on the toggle's inner icon were not handled
  reliably ([#101](https://github.com/techgaun/active-forks/pull/101)).
