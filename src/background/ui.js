function getPanelTab(panelUrl) {
    return new Promise((resolve, reject) => {
        let views = browser.extension.getViews({type: "tab"});

        if (views.length) {
            browser.tabs.query({}).then(
                (tabs) => {
                    for (let tab of tabs) {
                        if (tab.url === panelUrl) {
                            resolve(tab);
                            return;
                        }
                    }
                    reject();
                },
                () => reject()
            );
        }
        else {
            reject();
        }
    });
}


function createTabAndSendMessage(tabParams, message) {
    browser.tabs.create(tabParams).then(
        (tab) => {
            let sendMessage = () => browser.tabs.sendMessage(tab.id, message);

            if (tab.status !== "complete") {
                let listener = function (tabId, changeInfo, tab) {
                    if (tabId === tab.id && changeInfo.status === "complete") {
                        sendMessage();
                        browser.tabs.onUpdated.removeListener(listener);

                    }
                };
                browser.tabs.onUpdated.addListener(listener);
            }
            else if (tab.status === "complete") {
                sendMessage();
            }
        }
    );
}


function openPanel() {
    let panelUrl = browser.extension.getURL("panel/panel.html");

    getPanelTab(panelUrl).then(
        (tab) => browser.tabs.update(tab.id, {active: true}),
        () => {
            //browser.tabs.create({url: panelUrl, active: true}).then()
            createTabAndSendMessage({url: panelUrl, active: true}, {
                action: "pause-changed",
                paused: ihgng.downloadList.paused
            });
        }
    );
}


function openLinkSelect(links) {
    let panelUrl = browser.extension.getURL("link_select/link_select.html");

    createTabAndSendMessage({url: panelUrl, active: true}, {
        action: "set-links",
        links: links
    });

    /*
    browser.tabs.create({url: panelUrl, active: true}).then(
        (tab) => {
            let sendLinks = () => browser.tabs.sendMessage(tab.id, {
                links: links
            });

            if (tab.status !== "complete") {
                let listener = function (tabId, changeInfo, tab) {
                    if (changeInfo.status === "complete") {
                        sendLinks();
                        browser.tabs.onUpdated.removeListener(listener);

                    }
                };
                browser.tabs.onUpdated.addListener(listener);
            }
            else if (tab.status === "complete") {
                sendLinks();
            }

        }
    );*/
}


export {
    getPanelTab,
    openLinkSelect,
    openPanel
}