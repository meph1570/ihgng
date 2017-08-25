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


function openPanel() {
    let panelUrl = browser.extension.getURL("panel/panel.html");

    getPanelTab(panelUrl).then(
        (tab) => browser.tabs.update(tab.id, {active: true}),
        () => browser.tabs.create({url: panelUrl, active: true})
    );
}


function openLinkSelect(links) {
    let panelUrl = browser.extension.getURL("link_select/link_select.html");

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
    );
}


async function openSettings() {
    let settingsUrl = browser.extension.getURL("settings/settings.html");

    getPanelTab(settingsUrl).then(
        (tab) => browser.tabs.update(tab.id, {active: true}),
        () => {
            browser.tabs.create({url: settingsUrl, active: true}).then(
                (tab) => {
                    let sendConfig = () => {
                        let preparedHosters = [];

                        let copyHosters = (hosters) => {
                            for (let hosterId in hosters) {
                                if (hosters.hasOwnProperty(hosterId)) {
                                    let hoster = hosters[hosterId];
                                    preparedHosters.push({
                                        id: hoster.id,
                                        source: hoster.source,
                                        urlpattern: hoster.urlpattern,
                                        searchpattern: hoster.searchpattern
                                    });
                                }
                            }
                        };

                        copyHosters(ihgng.hosters.hosters);
                        copyHosters(ihgng.hosters.matchedHosters);

                        preparedHosters.sort((a, b) => { return b.id < a.id });

                        browser.storage.local.get().then((storage) => {
                            // Clone for vue
                            let config = Object.assign(
                                {},
                                ihgng.config,
                                {
                                    hosters: preparedHosters,
                                }
                            );

                            for (let key of Object.keys(storage)) {
                                let match = key.match(/hostfile:(.+)/);

                                if (match) {
                                    let [prefix, url] = match;
                                    let hostfile = storage[key];

                                    for (let configHostFile of config.hostfiles) {
                                        if (configHostFile.url === url) {
                                            configHostFile.lastSync = hostfile.lastSync;
                                            break;
                                        }
                                    }
                                }
                            }

                            browser.tabs.sendMessage(tab.id, {
                                action: "config",
                                config: config
                            });
                        });
                    };

                    if (tab.status !== "complete") {
                        let listener = function (tabId, changeInfo, tab) {
                            if (changeInfo.status === "complete") {
                                sendConfig();
                                browser.tabs.onUpdated.removeListener(listener);

                            }
                        };
                        browser.tabs.onUpdated.addListener(listener);
                    }
                    else if (tab.status === "complete") {
                        sendConfig();
                    }
                }
            );
        }
    );
}

export {
    openLinkSelect,
    openPanel,
    openSettings
}