window.addEventListener('load', () => {
  initDT(); // Initialize the DatatTable and window.columnNames variables

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
  const repo = document.getElementById('q').value;
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

function updateDT(data, repo) {
  // Remove any alerts, if any:
  if ($('.alert')) $('.alert').remove();

  // Format dataset and redraw DataTable. Use second index for key name
  const forks = [];

  Promise.all(data.map(fork =>
    fetch(`https://api.github.com/repos/${repo}/compare/master...${fork.owner.login}:master`)
      .then(resp => resp.json())
      .then(data => {
        fork.repoLink = `<a href="https://github.com/${fork.full_name}">Link</a>`;
        fork.ownerName = fork.owner.login;
        fork.status = data.status;
        fork.ahead_by = data.ahead_by;
        fork.behind_by = data.behind_by;
        fork.total_commits = data.total_commits;
        forks.push(fork);
      })
  ))
    .then(_ => {
      const dataSet = forks.map(fork =>
        window.columnNamesMap.map(colNM => fork[colNM[1]])
      );
      window.forkTable
        .clear()
        .rows.add(dataSet)
        .draw();
    })
    .catch(error => {
      handleError(error);
    });
}

function initDT() {
  // Create ordered Object with column name and mapped display name
  window.columnNamesMap = [
    // [ 'Repository', 'full_name' ],
    ['Link', 'repoLink'], // custom key
    ['Owner', 'ownerName'], // custom key
    ['Name', 'name'],
    ['Branch', 'default_branch'],
    ['Stars', 'stargazers_count'],
    ['Forks', 'forks'],
    ['Open Issues', 'open_issues_count'],
    ['Size', 'size'],
    ['Last Push', 'pushed_at'],
    ['Status', 'status'],
    ['Status', 'status'],
    ['Ahead by', 'ahead_by'],
    ['Behind by', 'behind_by'],
    ['Commits', 'total_commits'],
  ];

  // Sort by stars:
  const sortColName = 'Stars';
  const sortColumnIdx = window.columnNamesMap
    .map(pair => pair[0])
    .indexOf(sortColName);

  // Use first index for readable column name
  // we use moment's fromNow() if we are rendering for `pushed_at`; better solution welcome
  window.forkTable = $('#forkTable').DataTable({
    columns: window.columnNamesMap.map(colNM => {
      return {
        title: colNM[0],
        render:
          colNM[1] === 'pushed_at'
            ? (data, type, _row) => {
              if (type === 'display') {
                return moment(data).fromNow();
              }
              return data;
            }
            : null,
      };
    }),
    order: [[sortColumnIdx, 'desc']],
  });
}

function fetchAndShow(repo) {
  repo = repo.replace('https://github.com/', '');
  repo = repo.replace('http://github.com/', '');
  repo = repo.replace('.git', '');

  fetch(
    `https://api.github.com/repos/${repo}/forks?sort=stargazers&per_page=100`
  )
    .then(response => {
      if (!response.ok) throw Error(response.statusText);
      return response.json();
    })
    .then(data => {
      updateDT(data, repo);
    })
    .catch(error => {
      handleError(error);
    });
}

function handleError(error) {
  const msg =
    error.toString().indexOf('Forbidden') >= 0
      ? 'Error: API Rate Limit Exceeded'
      : error;
  showMsg(`${msg}. Additional info in console`, 'danger');
  console.error(error);
}

function showMsg(msg, type) {
  let alert_type = 'alert-info';

  if (type === 'danger') {
    alert_type = 'alert-danger';
  }

  document.getElementById('footer').innerHTML = '';

  document.getElementById('data-body').innerHTML = `
        <div class="alert ${alert_type} alert-dismissible fade show" role="alert">
            <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                <span aria-hidden="true">&times;</span>
            </button>
            ${msg}
        </div>
    `;
}

function getRepoFromUrl() {
  const urlRepo = location.hash && location.hash.slice(1);

  return urlRepo && decodeURIComponent(urlRepo);
}
