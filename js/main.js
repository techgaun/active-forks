window.addEventListener('load', () => {
    initDT()  // Initialize the DatatTable and window.columnNames variables

    const repo = getRepoFromUrl();

    if (repo) {
        document.getElementById('q').value = repo;
        fetchData();
    }
});

document.getElementById('form').addEventListener('submit', (e) => {
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
        showMsg('Invalid GitHub repository! Format is &lt;username&gt;/&lt;repo&gt;', 'danger');
    }
}

function updateDT( data ) {
    // Remove any alerts, if any:
    if ( $( '.alert' ) )
        $( '.alert' ).remove()

    // Format dataset and redraw DataTable. Use second index for key name
    const forks = []
    for ( let fork of data ) {
      fork.repoLink = `<a href="https://github.com/${fork.full_name}">Link</a>`
      fork.ownerName = fork.owner.login
      fork.pushed_at = moment(fork.pushed_at).fromNow()
      forks.push( fork )
    }
    const dataSet = forks.map( fork => window.columnNamesMap.map( colNM => fork[colNM[1]] ) )
    window.forkTable.clear().rows.add( dataSet ).draw()
}

function initDT() {
    // Create ordered Object with column name and mapped display name
    window.columnNamesMap = [
        // [ 'Repository', 'full_name' ],
        ['Link', 'repoLink'],  // custom key
        ['Owner', 'ownerName'],  // custom key
        ['Name', 'name'],
        ['Branch', 'default_branch'],
        ['Stars', 'stargazers_count'],
        ['Forks', 'forks'],
        ['Open Issues', 'open_issues_count'],
        ['Size', 'size'],
        ['Last Push', 'pushed_at'],
    ]

    // Sort by stars:
    const sortColName = 'Stars'
    const sortColumnIdx = window.columnNamesMap.map( pair => pair[0] ).indexOf( sortColName )

    // Use first index for readable column name
    window.forkTable = $( '#forkTable' ).DataTable( {
        columns: window.columnNamesMap.map( colNM => {
            return {'title': colNM[0]}
        } ),
        'order': [[sortColumnIdx, 'desc']],
    } )
}

function fetchAndShow( repo ) {

  fetch( `https://api.github.com/repos/${repo}/forks?sort=stargazers` )
    .then( ( response ) => {
      if ( !response.ok )
        throw Error( response.statusText )
      return response.json()
    } )
    .then( ( data ) => {
        console.log( data )
        updateDT( data )
    } )
    .catch( ( error ) => {
        const msg = error.toString().indexOf( 'Forbidden' ) >= 0 ? 'Error: API Rate Limit Exceeded' : error
        showMsg( `${msg}. Additional info in console`, 'danger' )
        console.error( error )
    } )
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

function showData(data) {
    if (!Array.isArray(data)) {
        showMsg('GitHub repository does not exist', 'danger');
        return;
    }

    if (data.length === 0) {
        showMsg('No forks exist!');
        return;
    }

    const html = [];
    const thead = `
        <thead>
            <tr class="table-active">
                <th><i class="fa fa-github" aria-hidden="true"></i> Repository</th>
                <th><i class="fa fa-star" aria-hidden="true"></i> Stargazers</th>
                <th><i class="fa fa-code-fork" aria-hidden="true"></i> Forks</th>
                <th><i class="fa fa-clock-o" aria-hidden="true"></i> Last Push</th>
            </tr>
        </thead>
    `;

    for (const fork of data) {
        const item = `
            <tr>
                <td><a href="${fork.html_url}">${fork.full_name}</a></td>
                <td>${fork.stargazers_count}</td>
                <td>${fork.forks_count}</td>
                <td>${timeSince(fork.pushed_at)} ago</td>
            </tr>
        `;
        html.push(item);
    }

    document.getElementById('data-body').innerHTML = `
        <div class="table-responsive rounded">
            <table class="table table-striped table-bordered table-hover">
                ${thead}
                <tbody>${html.join('')}</tbody>
            </table>
        </div>
    `;

    document.getElementById('footer').innerHTML = `${data.length} ${data.length == 1 ? 'result' : 'results'}`;
}

function getRepoFromUrl() {
    const urlRepo = location.hash && location.hash.slice(1);

    return urlRepo && decodeURIComponent(urlRepo);
}

function timeSince(date_str) {
    const date = new Date(date_str);
    const seconds = Math.floor((new Date() - date) / 1000);

    let interval = Math.floor(seconds / 31536000);

    if (interval > 1) {
        return interval + ' years';
    }

    interval = Math.floor(seconds / 2592000);
    if (interval > 1) {
        return interval + ' months';
    }

    interval = Math.floor(seconds / 86400);
    if (interval > 1) {
        return interval + ' days';
    }

    interval = Math.floor(seconds / 3600);
    if (interval > 1) {
        return interval + ' hours';
    }

    interval = Math.floor(seconds / 60);
    if (interval > 1) {
        return interval + ' minutes';
    }

    return Math.floor(seconds) + ' seconds';
}
