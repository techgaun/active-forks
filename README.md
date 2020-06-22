# active-forks

> Find the active github forks of a project

This project allows you to find the most active forks of a repository.

[Find Active Fork](https://techgaun.github.io/active-forks/index.html)

Use this tool as a bookmarklet. Since Github doesn't allow javascript in its markdown, you can add it manually. Hit Ctrl+D to create a new bookmark and paste the javascript below into the URL or "Location" entry (you may have to click "More" to see the URL field). Any time you're on a Github repo you can click the bookmarklet and it'll bring up the Active Forks of that repo.

`javascript:var title=document.title;if(title){  thing=title.split(':');var newPage = 'https://techgaun.github.io/active-forks/index.html#'+thing[0];open(newPage ,'targetname')}`

![Screenshot](screenshot.png "Active Forks in Action")
