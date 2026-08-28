// Popup: preview the top forks of the repository in the active tab.
// DOM is built with createElement/textContent only — no HTML injection.

const SITE = 'https://techgaun.github.io/active-forks/index.html';

// Kept in sync with background.js (no build step, so the helper is duplicated)
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

function howLongAgo(date) {
  if (!date) return 'unknown';
  const relTime = new Intl.RelativeTimeFormat(navigator.language, { style: 'narrow' });
  const elapsedHours = (Date.now() - Date.parse(date)) / 1000 / 60 / 60;
  const elapsedDays = elapsedHours / 24;
  if (elapsedHours < 24) return relTime.format(-Math.floor(elapsedHours), 'hour');
  if (elapsedDays < 31) return relTime.format(-Math.floor(elapsedDays), 'day');
  if (elapsedDays < 365) return relTime.format(-Math.floor(elapsedDays / 30), 'month');
  return relTime.format(-Math.floor(elapsedDays / 365.25), 'year');
}

const status = document.getElementById('status');
const list = document.getElementById('fork-list');
const sortToggle = document.getElementById('sort-toggle');
const starsFormat = new Intl.NumberFormat(navigator.language, { notation: 'compact' });
const cache = {}; // sort key -> forks, per popup lifetime
let currentRepo = null;

function showStatus(message) {
  list.hidden = true;
  status.hidden = false;
  status.textContent = message;
}

function renderForks(forks) {
  list.textContent = '';
  for (const fork of forks) {
    if (!fork.owner) continue;
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = `https://github.com/${fork.full_name}`;
    link.target = '_blank';
    link.rel = 'noopener';

    const avatar = document.createElement('img');
    avatar.src = `${fork.owner.avatar_url}&s=40`;
    avatar.width = 20;
    avatar.height = 20;
    avatar.alt = '';

    const name = document.createElement('span');
    name.className = 'fork-name';
    name.textContent = fork.full_name;

    const meta = document.createElement('span');
    meta.className = 'fork-meta';
    meta.textContent = `★ ${starsFormat.format(fork.stargazers_count)} · ${howLongAgo(fork.pushed_at)}`;

    link.append(avatar, name, meta);
    item.append(link);
    list.append(item);
  }
  status.hidden = true;
  list.hidden = false;
}

async function loadForks(sort) {
  document.getElementById('sort-stars').setAttribute('aria-pressed', String(sort === 'stargazers'));
  document.getElementById('sort-newest').setAttribute('aria-pressed', String(sort === 'newest'));

  if (cache[sort]) {
    renderForks(cache[sort]);
    return;
  }

  showStatus('Loading…');
  try {
    const response = await fetch(
      `https://api.github.com/repos/${currentRepo}/forks?sort=${sort}&per_page=10`,
      { headers: { Accept: 'application/vnd.github+json' } }
    );
    if (!response.ok) {
      showStatus(
        response.status === 403
          ? 'GitHub API rate limit exceeded — try again later or use the full view with a token.'
          : `Could not load forks (${response.status}).`
      );
      return;
    }
    const forks = await response.json();
    if (!forks.length) {
      showStatus('This repository has no forks.');
      return;
    }
    cache[sort] = forks;
    renderForks(forks);
  } catch (error) {
    showStatus('Could not load forks — network error.');
  }
}

document.getElementById('sort-stars').addEventListener('click', () => loadForks('stargazers'));
document.getElementById('sort-newest').addEventListener('click', () => loadForks('newest'));

chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
  currentRepo = repoFromUrl(tabs[0] && tabs[0].url);
  if (!currentRepo) {
    showStatus('Open a GitHub repository page to preview its forks.');
    return;
  }
  document.getElementById('title').textContent = currentRepo;
  document.getElementById('full-view').href = `${SITE}#${encodeURIComponent(currentRepo)}`;
  sortToggle.hidden = false;
  loadForks('stargazers');
});
