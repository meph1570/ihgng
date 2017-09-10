
import {HOSTFILE_DEFAULT_URL} from "../lib/globals"

import {Hosters} from "./hostfile";
import {DownloadList} from "./queue";
import {getPanelTab, handleMenu, openLinkSelect, openPanel} from "./ui"

const DEFAULT_CONFIG = {
    "hostfiles": [
        {
            url: HOSTFILE_DEFAULT_URL,
            enabled: true
        }
    ],
    "debug": true,
    "hideThumbs": false,
    "threads": 4
};


class IHGng {
    constructor() {
        this.hosters = new Hosters();
        this.downloadList = new DownloadList(this.hosters);
        this.downloadList.onPauseChanged = (paused) => this.onPause(paused);
        //this.downloadList.test();

        this.config = null;

        this.loadConfig();
    }

    loadConfig() {
        browser.storage.local.get("config").then((result) => {
            if (result.config) {
               this.config = result.config;
            }
            else {
               this.config = DEFAULT_CONFIG;
            }

            this.onConfigReady()
        });
    }

    storeConfig() {
        browser.storage.local.set({config: this.config}).then(
            () => {},
            () => console.error("[config] Saving config failed")
        );
    }

    onConfigReady() {
        this.storeConfig();

        this.hosters.debug = this.config.debug;
        this.hosters.load(this.config.hostfiles, {force: false}).then(
            () => console.log("[main] Hostfiles loaded"),
            () => console.error("[main] Hostfiles failed")
        );

        if (this.config.contextMenuEnabled) {
            this.createContextMenu();
        }
    }

    changeConfig(newConfig) {
        delete(newConfig.hosters); // hosters are synced directly

        if (this.config.contextMenuEnabled && !newConfig.contextMenuEnabled) {
            browser.menus.removeAll();
        }
        else if (!this.config.contextMenuEnabled && newConfig.contextMenuEnabled) {
            this.createContextMenu();
        }

        Object.assign(this.config, newConfig);

        this.hosters.maxConnections = newConfig.threads;

    createContextMenu() {
        browser.menus.create({
          id: "ihg-get-all-pics",
          title: "Get all pics",
          contexts: ["all"]
        });

        browser.menus.create({
          id: "ihg-get-some-pics",
          title: "Select pics",
          contexts: ["all"]
        });

        browser.menus.create({
          id: "ihg-open-panel",
          title: "Open panel",
          contexts: ["all"]
        });
    }

    onPause(paused) {
        getPanelTab(browser.extension.getURL("panel/panel.html")).then((tab) => {
            browser.tabs.sendMessage(tab.id, {
                action: "pause-changed",
                paused: paused
            })
        });
    }
}



function handleMessage(request, sender, sendResponse) {
    console.log("Message from the content script:", request, sender);

    if (request.action === "close") {
        browser.tabs.remove(sender.tab.id);
    }
    else if (request.action === "links") {
        //let links = request.links.filter((link) => ihgng.hosters.getHosterForUrlOrRedirect(link.url));
        let links = request.links
            .map((link) => { return { url: ihgng.hosters.getUrlOrRedirect(link.url), thumb: link.thumb }})
            .filter((link) => { return link.url !== null });

        if (!links.length) {
            sendResponse({action: "no_links"});
            return;
        }

        if (request.start) {
            console.log("Filtering links");
            console.debug("Starting", links);
            try {
                ihgng.downloadList.addLinks(sender.tab.title, links, {start: true});
            }
            catch (e) {
                /* Errors don't show up in console in message handlers */
                console.error(e);
            }

            if (request.close && request.close === true) {
                browser.tabs.remove(sender.tab.id);
            }
            browser.notifications.create(
                "ihgng",
                {
                    type: "basic",
                    title: "IHG-ng",
                    message: `${links.length} links queued`
                }
            );
            console.debug("Done");
        }
        else {
            openLinkSelect(links);
        }
    }
    else if (request.action === "test-hoster") {
        let params = request.params;
        let testing = ihgng.hosters.testHoster(
            params.id,
            params.urlpattern,
            params.searchpattern,
            params.errorpattern,
            params.filenamepattern,
            params.url
        );

        testing.then(
            (result) => {
                browser.tabs.sendMessage(sender.tab.id, {
                    action: "test-hoster",
                    result: result
                });
            },
            (e) => {
                browser.tabs.sendMessage(sender.tab.id, {
                    action: "test-hoster",
                    result: {
                        error: e.toString(),
                        stack: e.stack,
                        context: e.context ? e.context : null
                    }
                });
            }
        );
    }
    else if (request.action === "save-hoster") {
        let hoster = request.hoster;
        ihgng.hosters.localHostFile.addHoster(
            hoster.id,
            hoster.urlpattern,
            hoster.searchpattern,
            hoster.errorpattern,
            hoster.filenamepattern
        );
        browser.tabs.sendMessage(sender.tab.id, {
            action: "refresh-hosters",
            hosters: ihgng.hosters.getHosterList(),
            cause: "save-hoster",
            causeExtra: hoster.id
        });
    }
    else if (request.action === "delete-hoster") {
        ihgng.hosters.removeHoster(request.hosterId).then(() => {
            browser.tabs.sendMessage(sender.tab.id, {
                action: "refresh-hosters",
                hosters: ihgng.hosters.getHosterList(),
                cause: "delete-hoster"
            });
        });
    }
    else if (request.action === "refresh-hosters") {
        ihgng.hosters.reset().then(() => {
            browser.tabs.sendMessage(sender.tab.id, {
                action: "refresh-hosters",
                hosters: ihgng.hosters.getHosterList(),
                feedback: request.feedback ? request.feedback : false
            });
        });
    }
    else if (request.action === "save-config") {
        ihgng.changeConfig(request.config);
        browser.tabs.remove(sender.tab.id);
    }
    else {
        console.error("Unknown action received: ", request);
        console.error("Sender: ", sender);
    }
}


function collectLinks(start) {
    browser.tabs.query({active: true}).then((tabs) => {
        console.log(tabs);

        const tabId = tabs[0].id;
        browser.tabs.executeScript(tabId, {
            file: "/content_scripts/collect_links.js",
        }).then(
            () => {
                browser.tabs.sendMessage(tabId, {
                    start: start
                });
            }
        );
    });
}


browser.runtime.onMessage.addListener(handleMessage);
browser.menus.onClicked.addListener((info, tab) => {
    console.log(info, tab);
    handleMenu(window, info.menuItemId, false);
});

// Expose necessary objects for content scripts
window.ihgng = new IHGng();
window.collectLinks = collectLinks;

window.openPanel = openPanel;
window.openLinkSelect = openLinkSelect;

window.getDownloadList = function () {
    console.error("[warning] getDownloadList is deprecated");
    return window.ihgng.downloadList;
};

console.log("IHG-ng 0.1.0");