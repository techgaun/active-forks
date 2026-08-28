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

  if(localStorage.getItem('darkmode') === '1') document.body.setAttribute('data-bs-theme', 'dark');

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

function fetchData() {
  const repo = document.getElementById('q').value.replaceAll(' ','');
  const re = /[-_\w]+\/[-_.\w]+/;

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
    fork.repoLink = `<a href="https://github.com/${fork.full_name}">Link</a>`;
    const avatarUrl = (fork.owner && fork.owner.avatar_url) || 'https://avatars.githubusercontent.com/u/0?v=4';
    fork.ownerName = `<img src="${avatarUrl}&s=48" width="24" height="24" class="me-2 rounded-circle" />${fork.owner ? fork.owner.login : '<strike><em>Unknown</em></strike>'}`;
    forks.push(fork);
  }
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

function getColumnRenderer(key) {
  if (key === 'pushed_at') {
    return (data, type, _row) => {
      if (type === 'display') {
        return howLongAgo(data);
      }
      return data;
    };
  }
  if (key === 'ahead_by' || key === 'behind_by') {
    // null means unknown (no token, compare failed, or not fetched yet)
    return (data, type, _row) => {
      if (data === null) {
        return type === 'display' ? '–' : -1;
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
    ['Size', 'size'],
    ['Last Push', 'pushed_at'],
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
const COMPARE_CONCURRENCY = 8;

async function startAheadBehind(repo, forks, headers, signal) {
  let baseBranch;
  try {
    const response = await fetch(`https://api.github.com/repos/${repo}`, { headers, signal });
    if (!response.ok) throw Error(response.statusText);
    baseBranch = (await response.json()).default_branch;
  } catch (error) {
    if (error.name !== 'AbortError') console.error('Could not determine upstream default branch', error);
    return;
  }
  if (signal.aborted) return;

  const table = window.forkTable;
  const aheadColIdx = window.columnNamesMap.findIndex(colNM => colNM[1] === 'ahead_by');
  const behindColIdx = window.columnNamesMap.findIndex(colNM => colNM[1] === 'behind_by');
  const queue = [];
  const queued = new Set(); // row indexes already fetched or in flight
  let activeWorkers = 0;
  let capWarned = false;

  const applyResult = (rowIdx, ahead, behind) => {
    table.cell(rowIdx, aheadColIdx).data(ahead);
    table.cell(rowIdx, behindColIdx).data(behind);
    table.draw(false);
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

  const worker = async () => {
    while (queue.length) {
      if (signal.aborted) return;
      const { fork, rowIdx } = queue.shift();
      try {
        let comparison;
        try {
          comparison = await compareOnce(fork.owner.login, fork.default_branch);
        } catch (error) {
          if (error.status !== 404) throw error;
          // The forks listing can be stale: the fork may have been renamed or
          // deleted since. Look it up by immutable id and retry once if renamed.
          const response = await fetch(`https://api.github.com/repositories/${fork.id}`, { headers, signal });
          if (!response.ok) throw error;
          const current = await response.json();
          if (
            current.owner.login === fork.owner.login &&
            current.default_branch === fork.default_branch
          ) {
            throw error; // same coordinates, e.g. an empty fork — retrying won't help
          }
          comparison = await compareOnce(current.owner.login, current.default_branch);
        }
        applyResult(rowIdx, comparison.ahead_by, comparison.behind_by);
      } catch (error) {
        if (error.name === 'AbortError') return;
        // fork deleted, private, or empty — leave cells unknown
      }
    }
  };

  const spawnWorkers = () => {
    // worker() dequeues its first item synchronously, so queue.length shrinks each spin
    while (activeWorkers < COMPARE_CONCURRENCY && queue.length) {
      activeWorkers++;
      worker().finally(() => {
        activeWorkers--;
        if (queue.length) spawnWorkers();
      });
    }
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
    if (!fork || !fork.owner) return;
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
    spawnWorkers();
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
    spawnWorkers();
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
  repo = repo.replace('https://github.com/', '');
  repo = repo.replace('http://github.com/', '');
  repo = repo.replace(/\.git$/, '');
  repo = repo.replace(/^\s+/, ''); // remove leading whitespace
  repo = repo.replace(/\s+$/, ''); // remove trailing whitespace
  repo = repo.replace(/^\/+/, ''); // remove leading slashes
  repo = repo.replace(/\/+$/, ''); // remove trailing slashes

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

  fetchForkPages(repo, headers, maxPages, controller.signal)
    .then(async ({ forks, truncated }) => {
      updateDT(forks);

      const notices = [];
      if (truncated) {
        notices.push(`Showing the first ${forks.length} forks`);
      }
      if (!token) {
        notices.push(
          'Add a GitHub token below the search box to fetch more forks and see ahead/behind commit counts'
        );
      }
      if (notices.length) showMsg(`${notices.join('. ')}.`, 'info');

      if (token && forks.length) {
        startAheadBehind(repo, forks, headers, controller.signal);
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
  const button = event.target;
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