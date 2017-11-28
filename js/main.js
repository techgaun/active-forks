window.addEventListener('load', () => {
    const repo = getQueryParams().q;
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

    window.history.pushState('', '', `?q=${repo}`);

    if (re.test(repo)) {
        fetchAndShow(repo);
    } else {
        showMsg('Invalid GitHub repository! Format is &lt;username&gt;/&lt;repo&gt;', 'danger');
    }
}

function fetchAndShow(repo) {
    document.getElementById('find').disabled = true;
    document.getElementById('spinner').removeAttribute('hidden');

    fetch(`https://api.github.com/repos/${repo}/forks?sort=stargazers`)
        .then((response) => response.json())
        .then((data) => {
          showData(data);

          document.getElementById('find').disabled = false;
          document.getElementById('spinner').setAttribute('hidden', 'hidden');
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

function getQueryParams() {
    let query = location.search;
    if (!query) {
        return { };
    }

    return (/^[?#]/.test(query) ? query.slice(1) : query)
    .split('&')
    .reduce((params, param) => {
        let [ key, value ] = param.split('=');
        params[key] = value ? decodeURIComponent(value.replace(/\+/g, ' ')) : '';
        return params;
    }, { });
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
