/**
 *
 * @source: background/ui.js
 *
 * @licstart
 *
 * Copyright (C) 2017  Mephisto
 *
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * @licend
 *
 */

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


function openLinkSelect(links, hideThumbs) {
    let panelUrl = browser.extension.getURL("link_select/link_select.html");

    createTabAndSendMessage({url: panelUrl, active: true}, {
        action: "set-links",
        links: links,
        hideThumbs: hideThumbs
    });
}

function handleMenu(ihg, id, shiftKey) {
    if (id === "ihg-get-all-pics") {
        ihg.collectLinks(true);
        if (!shiftKey) {
            ihg.openPanel();
        }
    }
    else if (id === "ihg-open-panel") {
        ihg.openPanel();
    }
    else if (id === "ihg-get-some-pics") {
        ihg.collectLinks(false);
    }
    else if (id === "ihg-settings") {
        browser.runtime.openOptionsPage();
    }
}


export {
    handleMenu,
    getPanelTab,
    openLinkSelect,
    openPanel
}