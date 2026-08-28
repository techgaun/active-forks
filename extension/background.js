// Registers the context-menu entries and opens the full Active Forks view.
// Uses the `chrome` namespace with callbacks, which works in both Chromium
// and Firefox (MV3).

const SITE = 'https://techgaun.github.io/active-forks/index.html';

// Paths under github.com that are not "owner" segments of a repository URL.
// Kept in sync with popup.js (no build step, so the helper is duplicated).
const RESERVED_OWNERS = [
  'about', 'apps', 'codespaces', 'collections', 'contact', 'enterprise',
  'explore', 'features', 'issues', 'login', 'marketplace', 'new',
  'notifications', 'orgs', 'pricing', 'pulls', 'search', 'settings',
  'sponsors', 'topics', 'trending',
];

function repoFromUrl(url) {
  const match = /^https?:\/\/(?:www\.)?github\.com\/([^/?#]+)\/([^/?#]+)/.exec(url || '');
  if (!match || RESERVED_OWNERS.includes(match[1])) return null;
  return `${decodeURIComponent(match[1])}/${decodeURIComponent(match[2]).replace(/\.git$/, '')}`;
}

chrome.runtime.onInstalled.addListener(() => {
  // On GitHub pages: act on the page's own repository
  chrome.contextMenus.create({
    id: 'active-forks-page',
    title: 'Find active forks',
    contexts: ['page'],
    documentUrlPatterns: ['https://github.com/*'],
  });
  // Anywhere: act on a right-clicked link to a GitHub repository
  chrome.contextMenus.create({
    id: 'active-forks-link',
    title: 'Find active forks of linked repository',
    contexts: ['link'],
    targetUrlPatterns: ['https://github.com/*'],
  });
});

chrome.contextMenus.onClicked.addListener(info => {
  const source = info.menuItemId === 'active-forks-link' ? info.linkUrl : info.pageUrl;
  const repo = repoFromUrl(source);
  chrome.tabs.create({ url: repo ? `${SITE}#${encodeURIComponent(repo)}` : SITE });
});
