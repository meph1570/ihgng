

document.addEventListener("click", (e) => {
    let ihg = browser.extension.getBackgroundPage();

    console.log(e.target);

    if (e.target.id === "ihg-get-all-pics") {
        ihg.collectLinks(true);
        if (!e.shiftKey) {
            ihg.openPanel();
        }
    }
    else if (e.target.id === "ihg-open-panel") {
        ihg.openPanel();
    }
    else if (e.target.id === "ihg-get-some-pics") {
        ihg.collectLinks(false);
    }
    else if (e.target.id === "ihg-settings") {
        browser.runtime.openOptionsPage();
    }
    window.close();
});