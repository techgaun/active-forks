window.addEventListener('load', () => {
  initDT(); // Initialize the DatatTable and window.columnNames variables
  document.getElementById('dark-mode-toggle').addEventListener('click', toggleDarkMode);

  const tokenInput = document.getElementById('token');
  tokenInput.value = getToken();
  tokenInput.addEventListener('change', () => {
    const token = tokenInput.value.trim();
    if (token) localStorage.setItem('github-token', token);
    else localStorage.removeItem('github-token');
  });

  // Follow the OS color scheme until the user makes an explicit choice
  const storedDarkMode = localStorage.getItem('darkmode');
  const darkMode =
    storedDarkMode === null
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : storedDarkMode === '1';
  if (darkMode) {
    document.body.setAttribute('data-bs-theme', 'dark');
    document.getElementById('dark-mode-toggle').ariaPressed = 'true';
  }

  const repo = getRepoFromUrl();

  if (repo) {
    document.getElementById('q').value = repo;
    fetchData();
  }
});

document.getElementById('form').addEventListener('submit', e => {
  e.preventDefault();
  fetchData();
});

// Accept "owner/repo" as well as pasted GitHub URLs, including ones with
// extra path segments (/tree/main, /issues, ...) or a trailing .git
function normalizeRepoInput(input) {
  let path = input.replaceAll(' ', '');
  const url = URL.parse(path.includes('://') ? path : `https://${path}`);
  if (url && (url.hostname === 'github.com' || url.hostname === 'www.github.com')) {
    path = url.pathname;
  }
  const segments = path.split('/').filter(Boolean);
  if (segments.length < 2) return path.replace(/^\/+|\/+$/g, '');
  return `${segments[0]}/${segments[1].replace(/\.git$/, '')}`;
}

function fetchData() {
  const repo = normalizeRepoInput(document.getElementById('q').value);
  const re = /^[-_\w]+\/[-_.\w]+$/;

  const urlRepo = getRepoFromUrl();

  if (!urlRepo || urlRepo !== repo) {
    window.history.pushState('', '', `#${repo}`);
  }

  if (re.test(repo)) {
    fetchAndShow(repo);
  } else {
    showMsg(
      'Invalid GitHub repository! Format is &lt;username&gt;/&lt;repo&gt;',
      'danger'
    );
  }
}

function updateDT(data) {
  // Remove any alerts, if any:
  if ($('.alert')) $('.alert').remove();

  // Format dataset and redraw DataTable. Use second index for key name
  const forks = [];
  for (let fork of data) {
    if (fork.ahead_by === undefined) fork.ahead_by = null;
    if (fork.behind_by === undefined) fork.behind_by = null;
    if (fork.latest_release === undefined) fork.latest_release = null;
    fork.repoLink = `<a href="https://github.com/${fork.full_name}">Link</a>`;
    const avatarUrl = (fork.owner && fork.owner.avatar_url) || 'https://avatars.githubusercontent.com/u/0?v=4';
    fork.ownerName = `<img src="${avatarUrl}&s=48" width="24" height="24" loading="lazy" decoding="async" class="me-2 rounded-circle" />${fork.owner ? fork.owner.login : '<strike><em>Unknown</em></strike>'}`;
    if (fork.isUpstream) {
      fork.ownerName += ' <span class="badge text-bg-secondary">upstream</span>';
    }
    forks.push(fork);
  }
  window.currentForks = forks;
  const dataSet = forks.map(fork =>
    window.columnNamesMap.map(colNM => fork[colNM[1]])
  );
  window.forkTable
    .clear()
    .rows.add(dataSet)
    .draw();
  makeTableKeyboardScrollable();
}

// Will replace with JavaScript Temporal once supported in major browsers
function howLongAgo(date) {
  const relTime = new Intl.RelativeTimeFormat(navigator.language, { style: 'long' });
  if(!date) return 'Unknown';

  const startDateMilliseconds = Date.parse(date);
  const endDateMilliseconds = Date.parse(new Date());

  const elapsedSeconds = (endDateMilliseconds - startDateMilliseconds) / 1000;
  const elapsedHours = elapsedSeconds / 60 / 60;
  const elapsedDays = elapsedHours / 24;
  const elapsedMonths = elapsedDays / 30;
  const elapsedYears = elapsedDays / 365.25;

  if(elapsedHours < 24)
    return relTime.format(-Math.floor(elapsedHours), 'hour');
  if(elapsedDays < 31)
    return relTime.format(-Math.floor(elapsedDays), 'day');
  if(elapsedMonths < 12)
    return relTime.format(-Math.floor(elapsedMonths), 'month');
  return relTime.format(-Math.floor(elapsedYears), 'year');
}

// The GitHub API reports repository size in kilobytes
function humanizeSize(kilobytes) {
  const units = ['kilobyte', 'megabyte', 'gigabyte', 'terabyte'];
  let value = kilobytes;
  let unitIdx = 0;
  while (value >= 1024 && unitIdx < units.length - 1) {
    value /= 1024;
    unitIdx++;
  }
  return new Intl.NumberFormat(navigator.language, {
    style: 'unit',
    unit: units[unitIdx],
    unitDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(value);
}

function escapeHtml(text) {
  return String(text).replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function getColumnRenderer(key) {
  if (key === 'pushed_at' || key === 'created_at') {
    return (data, type, _row) => {
      if (type === 'display') {
        return howLongAgo(data);
      }
      return data;
    };
  }
  if (key === 'has_issues') {
    return (data, type, _row) => {
      if (type === 'display' || type === 'filter') {
        return data ? 'Yes' : 'No';
      }
      return data ? 1 : 0;
    };
  }
  if (key === 'latest_release') {
    // null means no release found (or not fetched yet — requires a token)
    return (data, type, _row) => {
      if (!data) {
        return type === 'display' || type === 'filter' ? '–' : '';
      }
      if (type === 'display') {
        return `<a href="${escapeHtml(data.url)}">${escapeHtml(data.tagName)}</a>`;
      }
      if (type === 'filter') {
        return data.tagName;
      }
      return data.publishedAt || ''; // order chronologically
    };
  }
  if (key === 'size') {
    return (data, type, _row) => {
      if (type === 'display') {
        return humanizeSize(data);
      }
      return data;
    };
  }
  if (key === 'ahead_by' || key === 'behind_by') {
    // null means unknown (no token, compare failed, or not fetched yet)
    return (data, type, _row, meta) => {
      if (data === null) {
        return type === 'display' ? '–' : -1;
      }
      if (type === 'display' && data > 0) {
        // Link to GitHub's compare view: Ahead shows the fork's unique
        // commits, Behind shows what upstream has that the fork lacks
        const fork = window.currentForks && window.currentForks[meta.row];
        if (fork && fork.compareOwner && window.currentRepo && window.compareBaseBranch) {
          const base = encodeURIComponent(window.compareBaseBranch);
          const head = `${encodeURIComponent(fork.compareOwner)}:${encodeURIComponent(fork.compareBranch)}`;
          const range = key === 'ahead_by' ? `${base}...${head}` : `${head}...${base}`;
          return `<a href="https://github.com/${window.currentRepo}/compare/${range}">${data}</a>`;
        }
      }
      return data;
    };
  }
  return null;
}

function initDT() {
  // Create ordered Object with column name and mapped display name
  window.columnNamesMap = [
    // [ 'Repository', 'full_name' ],
    ['Link', 'repoLink'], // custom key
    ['Owner', 'ownerName'], // custom key
    ['Name', 'name'],
    ['Branch', 'default_branch'],
    ['Ahead', 'ahead_by'], // custom key, filled in by startAheadBehind
    ['Behind', 'behind_by'], // custom key, filled in by startAheadBehind
    ['Stars', 'stargazers_count'],
    ['Forks', 'forks'],
    ['Open Issues', 'open_issues_count'],
    ['Issues Enabled', 'has_issues'],
    ['Release', 'latest_release'], // custom key, filled in by startAheadBehind
    ['Size', 'size'],
    ['Last Push', 'pushed_at'],
    ['Created', 'created_at'],
  ];

  // Sort by stars:
  const sortColName = 'Stars';
  const sortColumnIdx = window.columnNamesMap
    .map(pair => pair[0])
    .indexOf(sortColName);

  // Use first index for readable column name
  window.forkTable = $('#forkTable').DataTable({
    columns: window.columnNamesMap.map(colNM => {
      return {
        title: colNM[0],
        render: getColumnRenderer(colNM[1]),
      };
    }),
    order: [[sortColumnIdx, 'desc']],
    // paging: false,
    searchBuilder:{
      // all options at default
    }
  });
  let table = window.forkTable;
  new $.fn.dataTable.SearchBuilder(table, {});
  table.searchBuilder.container().prependTo(table.table().container());
  makeTableKeyboardScrollable();
}

function getToken() {
  const tokenInput = document.getElementById('token');
  return (tokenInput && tokenInput.value.trim()) || localStorage.getItem('github-token') || '';
}

// Extract the rel="next" URL from a Link response header, if any
function parseNextLink(header) {
  if (!header) return null;
  const match = header.match(/<([^>]+)>;\s*rel="next"/);
  return match ? match[1] : null;
}

async function fetchForkPages(repo, headers, maxPages, signal) {
  const forks = [];
  let url = `https://api.github.com/repos/${repo}/forks?sort=stargazers&per_page=100`;
  let page = 0;
  let truncated = false;

  while (url) {
    const response = await fetch(url, { headers, signal });
    if (!response.ok) throw Error(response.statusText);
    forks.push(...(await response.json()));
    page++;

    url = parseNextLink(response.headers.get('link'));
    if (url && page >= maxPages) {
      truncated = true;
      break;
    }
  }

  return { forks, truncated };
}

// Each ahead/behind lookup costs one API request per fork, so only run them
// when a token (5,000 requests/hour) is configured, and only for rows on the
// currently visible table page — more are fetched on demand as the user
// pages, sorts or filters. COMPARE_MAX is a per-search safety cap.
const COMPARE_MAX = 400;
// Number of forks resolved per GraphQL request (one aliased compare each)
const GRAPHQL_BATCH_SIZE = 50;

async function startAheadBehind(repo, baseBranch, forks, headers, signal) {
  // Context for rendering ahead/behind cells as links to GitHub's compare view
  window.currentRepo = repo;
  window.compareBaseBranch = baseBranch;

  const table = window.forkTable;
  const aheadColIdx = window.columnNamesMap.findIndex(colNM => colNM[1] === 'ahead_by');
  const behindColIdx = window.columnNamesMap.findIndex(colNM => colNM[1] === 'behind_by');
  const releaseColIdx = window.columnNamesMap.findIndex(colNM => colNM[1] === 'latest_release');
  const queue = [];
  const queued = new Set(); // row indexes already fetched or in flight
  let pumping = false;
  let capWarned = false;

  // These do not redraw — callers draw once per batch of updates
  const applyResult = (rowIdx, ahead, behind) => {
    table.cell(rowIdx, aheadColIdx).data(ahead);
    table.cell(rowIdx, behindColIdx).data(behind);
  };
  const applyRelease = (fork, rowIdx, release) => {
    fork.latest_release = release; // survives redraws sourced from the fork object
    table.cell(rowIdx, releaseColIdx).data(release);
  };

  const compareOnce = async (login, branch) => {
    const url =
      `https://api.github.com/repos/${repo}/compare/` +
      `${encodeURIComponent(baseBranch)}...` +
      `${encodeURIComponent(login)}:${encodeURIComponent(branch)}` +
      '?per_page=1';
    const response = await fetch(url, { headers, signal });
    if (!response.ok) throw Object.assign(Error(response.statusText), { status: response.status });
    return response.json();
  };

  // REST fallback for a single fork, with the by-id rename rescue. Used for
  // forks the GraphQL batch could not resolve (renamed/stale listing entries)
  // and as the wholesale fallback when a GraphQL request itself fails.
  const restCompareItem = async ({ fork, rowIdx }) => {
    try {
      let login = fork.owner.login;
      let branch = fork.default_branch;
      let comparison;
      try {
        comparison = await compareOnce(login, branch);
      } catch (error) {
        if (error.status !== 404) throw error;
        // The forks listing can be stale: the fork may have been renamed or
        // deleted since. Look it up by immutable id and retry once if renamed.
        const response = await fetch(`https://api.github.com/repositories/${fork.id}`, { headers, signal });
        if (!response.ok) throw error;
        const current = await response.json();
        if (current.owner.login === login && current.default_branch === branch) {
          throw error; // same coordinates, e.g. an empty fork — retrying won't help
        }
        login = current.owner.login;
        branch = current.default_branch;
        comparison = await compareOnce(login, branch);
      }
      // Remember the coordinates that worked so cells can link to them
      fork.compareOwner = login;
      fork.compareBranch = branch;
      applyResult(rowIdx, comparison.ahead_by, comparison.behind_by);
      table.draw(false);
    } catch (error) {
      if (error.name === 'AbortError') return;
      // fork deleted, private, or empty — leave cells unknown
    }
  };

  // Resolve a whole batch with one GraphQL request: an aliased compare per
  // fork costs a single rate-limit point, vs one REST request per fork.
  // Returns per-fork results aligned with the batch; unresolvable refs are null.
  const [upstreamOwner, upstreamName] = repo.split('/');
  const batchCompare = async batch => {
    const compareFields = batch
      .map(
        ({ fork }, i) =>
          `f${i}: compare(headRef: ${JSON.stringify(`${fork.owner.login}:${fork.default_branch}`)}) { aheadBy behindBy }`
      )
      .join(' ');
    // Fetch each fork's latest release in the same request
    const releaseFields = batch
      .map(
        ({ fork }, i) =>
          `r${i}: repository(owner: ${JSON.stringify(fork.owner.login)}, name: ${JSON.stringify(fork.name)}) ` +
          '{ latestRelease { tagName url publishedAt } }'
      )
      .join(' ');
    const query =
      `query { repository(owner: ${JSON.stringify(upstreamOwner)}, name: ${JSON.stringify(upstreamName)}) ` +
      `{ defaultBranchRef { ${compareFields} } } ${releaseFields} }`;
    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers,
      body: JSON.stringify({ query }),
      signal,
    });
    if (!response.ok) throw Error(response.statusText);
    const payload = await response.json();
    const data = payload.data;
    const ref = data && data.repository && data.repository.defaultBranchRef;
    if (!ref) throw Error('GraphQL compare returned no data');
    return batch.map((_item, i) => ({
      compare: ref[`f${i}`] || null,
      release: (data[`r${i}`] && data[`r${i}`].latestRelease) || null,
    }));
  };

  const pump = () => {
    if (pumping || signal.aborted || !queue.length) return;
    pumping = true;
    (async () => {
      try {
        while (queue.length && !signal.aborted) {
          const batch = queue.splice(0, GRAPHQL_BATCH_SIZE);
          let results;
          try {
            results = await batchCompare(batch);
          } catch (error) {
            if (error.name === 'AbortError') return;
            console.error('GraphQL batch compare failed; falling back to REST', error);
            results = batch.map(() => ({ compare: null, release: null }));
          }
          const failed = [];
          results.forEach((result, i) => {
            const { fork, rowIdx } = batch[i];
            if (result.release) {
              applyRelease(fork, rowIdx, result.release);
            }
            if (result.compare) {
              fork.compareOwner = fork.owner.login;
              fork.compareBranch = fork.default_branch;
              applyResult(rowIdx, result.compare.aheadBy, result.compare.behindBy);
            } else {
              failed.push(batch[i]);
            }
          });
          table.draw(false);
          await Promise.all(failed.map(restCompareItem));
        }
      } finally {
        pumping = false;
        if (queue.length && !signal.aborted) pump();
      }
    })();
  };

  const enqueueRow = rowIdx => {
    if (queued.has(rowIdx)) return;
    if (queued.size >= COMPARE_MAX) {
      if (!capWarned) {
        capWarned = true;
        console.warn(`Ahead/behind lookups capped at ${COMPARE_MAX} forks for this search`);
      }
      return;
    }
    // Row indexes match the order forks were added in updateDT
    const fork = forks[rowIdx];
    if (!fork || !fork.owner || fork.isUpstream) return;
    queued.add(rowIdx);
    queue.push({ fork, rowIdx });
  };

  // Queue lookups for the rows on the currently displayed page only
  const enqueueVisiblePage = () => {
    if (signal.aborted) return;
    table
      .rows({ page: 'current', search: 'applied', order: 'applied' })
      .indexes()
      .each(enqueueRow);
    pump();
  };

  // Sorting by Ahead/Behind is only meaningful once every row has data, so a
  // header click on those columns queues lookups for all (filtered) rows,
  // topmost first
  const enqueueAllRows = () => {
    if (signal.aborted) return;
    table
      .rows({ search: 'applied', order: 'applied' })
      .indexes()
      .each(enqueueRow);
    pump();
  };

  table.off('draw.dt.aheadBehind');
  table.off('order.dt.aheadBehind');
  table.on('draw.dt.aheadBehind', enqueueVisiblePage);
  table.on('order.dt.aheadBehind', () => {
    const sortsCompareColumn = table
      .order()
      .some(o => {
        const colIdx = Array.isArray(o) ? o[0] : o.idx;
        return colIdx === aheadColIdx || colIdx === behindColIdx;
      });
    if (sortsCompareColumn) enqueueAllRows();
  });
  signal.addEventListener('abort', () => {
    table.off('draw.dt.aheadBehind');
    table.off('order.dt.aheadBehind');
  });
  enqueueVisiblePage();
}

function fetchAndShow(repo) {
  // Cancel any search still in flight so responses can't interleave
  if (window.activeFetchController) window.activeFetchController.abort();
  const controller = new AbortController();
  window.activeFetchController = controller;

  const token = getToken();
  const headers = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  // Unauthenticated requests only get 60/hour, so keep page count modest
  const maxPages = token ? 30 : 4;
  const spinner = document.getElementById('spinner');
  spinner.hidden = false;

  const upstreamPromise = fetch(`https://api.github.com/repos/${repo}`, {
    headers,
    signal: controller.signal,
  }).then(response => {
    if (!response.ok) throw Error(response.statusText);
    return response.json();
  });

  // The upstream's latest release comes via REST so it also works without a
  // token; 404 (no releases) is expected
  const upstreamReleasePromise = fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
    headers,
    signal: controller.signal,
  })
    .then(response => (response.ok ? response.json() : null))
    .catch(() => null);

  Promise.all([
    upstreamPromise,
    upstreamReleasePromise,
    fetchForkPages(repo, headers, maxPages, controller.signal),
  ])
    .then(async ([upstream, upstreamRelease, { forks, truncated }]) => {
      // Show the upstream repository itself as the first row (it usually also
      // leads the default sort by stars)
      upstream.isUpstream = true;
      if (upstreamRelease) {
        upstream.latest_release = {
          tagName: upstreamRelease.tag_name,
          url: upstreamRelease.html_url,
          publishedAt: upstreamRelease.published_at,
        };
      }
      forks.unshift(upstream);
      updateDT(forks);

      const notices = [];
      if (truncated) {
        notices.push(`Showing the first ${forks.length - 1} forks`);
      }
      if (!token) {
        notices.push(
          'Add a GitHub token below the search box to fetch more forks and see ahead/behind commit counts'
        );
      }
      if (notices.length) showMsg(`${notices.join('. ')}.`, 'info');

      if (token && forks.length) {
        startAheadBehind(repo, upstream.default_branch, forks, headers, controller.signal);
      }
    })
    .catch(error => {
      if (error.name === 'AbortError') return;
      const msg =
        error.toString().indexOf('Forbidden') >= 0
          ? 'Error: API Rate Limit Exceeded. Add a GitHub token below the search box to raise the limit'
          : error;
      showMsg(`${msg}. Additional info in console`, 'danger');
      console.error(error);
    })
    .finally(() => {
      if (window.activeFetchController === controller) {
        spinner.hidden = true;
        window.activeFetchController = null;
      }
    });
}

function showMsg(msg, type) {
  let alert_type = 'alert-info';

  if (type === 'danger') {
    alert_type = 'alert-danger';
  }

  document.getElementById('footer').innerHTML = '';

  document.getElementById('data-body').innerHTML = `
        <div class="alert ${alert_type} alert-dismissible fade show" role="alert">
            ${msg}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    `;
}

function getRepoFromUrl() {
  const urlRepo = location.hash && location.hash.slice(1);

  return urlRepo && decodeURIComponent(urlRepo);
}

function toggleDarkMode(event) {
  // currentTarget: event.target can be one of the button's inner spans
  const button = event.currentTarget;
  if(button.ariaPressed === 'true') button.ariaPressed = 'false';
  else button.ariaPressed = 'true';
  document.body.setAttribute('data-bs-theme', button.ariaPressed === 'true' ? 'dark' : 'light');
  localStorage.setItem('darkmode', document.body.getAttribute('data-bs-theme') === 'dark' ? 1 : 0);
}

function makeTableKeyboardScrollable() {
  const tableContainer = document.querySelector('.dt-layout-full');
  tableContainer.setAttribute('aria-labelledby', 'table-container-label');
  tableContainer.setAttribute('role', 'region');
  tableContainer.setAttribute('tabindex', '0');
  tableContainer.classList.add('table-responsive');
}