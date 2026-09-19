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
  if (!match) return null;
  let owner;
  let repo;
  try {
    owner = decodeURIComponent(match[1]);
    repo = decodeURIComponent(match[2]);
  } catch {
    return null;
  }
  if (RESERVED_OWNERS.includes(owner.toLowerCase())) return null;
  return `${owner}/${repo.replace(/\.git$/, '')}`;
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
