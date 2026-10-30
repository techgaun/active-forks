window.addEventListener('load', () => {
    document.getElementById('dark-mode-toggle').addEventListener('click', toggleDarkMode);
});

function toggleDarkMode(event) {
    // currentTarget: event.target can be one of the button's inner spans
    const button = event.currentTarget;
    if(button.ariaPressed === 'true') button.ariaPressed = 'false';
    else button.ariaPressed = 'true';
    document.body.setAttribute('data-bs-theme', button.ariaPressed === 'true' ? 'dark' : 'light');
    localStorage.setItem('darkmode', document.body.getAttribute('data-bs-theme') === 'dark' ? 1 : 0);
}