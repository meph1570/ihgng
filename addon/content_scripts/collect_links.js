function handleResponse(message) {
    if (message) {
        console.log(message);
        if (message.action = "no_links") {
            window.alert("No links found");
        }
    }
}

function handleError(error) {
    console.log(`Error: ${error}`);
}

function collectLinks(start) {
    console.debug("Sending", document.links.length, "links");

    let links = [];

    for (let link of document.links) {
        let imgs = link.getElementsByTagName("img");
        let thumbnail = null;
        if (imgs.length) {
            if (imgs[0].src.startsWith("http")) {
                thumbnail = imgs[0].src;
            }
        }
        links.push({
            url: link.href,
            thumb: thumbnail
        });
    }

    let sending = browser.runtime.sendMessage({
        action: "links",
        links: links,
        start: start
    });
    sending.then(handleResponse, handleError);
}

browser.runtime.onMessage.addListener((message) => {
    console.debug("[collect_links] message received", message);
    collectLinks(message.start)
});