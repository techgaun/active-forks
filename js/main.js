function fetchData() {
    const repo = document.getElementById('repo').value
    const re = /[-_\w]+\/[-_.\w]+/

    if (re.test(repo)) {
        fetchAndShow(repo)
    } else {
        showError('Invalid github repo given. Format is <username>/<repo>')
    }
}

function fetchAndShow(repo) {
    fetch(`https://api.github.com/repos/${repo}/forks?sort=stargazers`)
        .then(function(response) {
            response.json()
                .then(function(data) {
                    showData(data)
                })
        })
}

function showError(msg) {
    document.getElementById('data-body').innerHTML = `<div class="alert alert-danger">${msg}</div>`
}

function showData(data) {
    if (!Array.isArray(data)) {
        showError('Github Repo does not exist')
        return
    }
    if (data.length === 0) {
        document.getElementById('data-body').innerHTML = `<div class="alert alert-info">No forks exist</div>`
        return
    }
    const thead = '<thead><tr><th>Repository</th><th>Stargazers</th><th>Forks</th><th>Last Update</th></tr></thead>'
    const html = []
    for (const fork of data) {
        const item = `
            <tr>
                <td><a href="${fork.html_url}">${fork.full_name}</a></td>
                <td>${fork.stargazers_count}</td>
                <td>${fork.forks_count}</td>
                <td>${timeSince(fork.updated_at)} ago</td>
            </tr>
        `
        html.push(item)
    }
    document.getElementById('data-body').innerHTML = `<table class="table table-striped">${thead}<tbody>${html.join()}</tbody></table>`
}

function timeSince(date_str) {
    const date = new Date(date_str)
    const seconds = Math.floor((new Date() - date) / 1000);

    let interval = Math.floor(seconds / 31536000);

    if (interval > 1) {
        return interval + " years";
    }
    interval = Math.floor(seconds / 2592000);
    if (interval > 1) {
        return interval + " months";
    }
    interval = Math.floor(seconds / 86400);
    if (interval > 1) {
        return interval + " days";
    }
    interval = Math.floor(seconds / 3600);
    if (interval > 1) {
        return interval + " hours";
    }
    interval = Math.floor(seconds / 60);
    if (interval > 1) {
        return interval + " minutes";
    }
    return Math.floor(seconds) + " seconds";
}
