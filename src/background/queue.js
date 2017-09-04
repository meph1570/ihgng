import { download, states } from "../lib/utils"


class Link {
    constructor(id, url) {
        this.id = id;
        this.url = url;
        this.state = states.DISABLED;
        this.progress = 0;
        this.total = 0;
        this.xhr = null;
        this.onProgress = null;
        this.onState = null;
        this.error = null;
        this.type = "link";
        this.selected = false;
        this.img = null;
    }

    attachXHR(xhr) {
        this.xhr = xhr;
        this.setState(states.DOWNLOADING);
    }

    cancel() {
        this.xhr.abort();
        this.xhr = null;
        this.updateProgress(0, 0);
        this.setState(states.CANCELLED);
    }

    updateProgress(loaded, total) {
        if (this.onProgress) {
            this.onProgress.call(this, loaded, total);
        }

        this.progress = loaded;
        this.total = total;
    }

    setState(state) {
        if (this.onState) {
            this.onState.call(this, state);
        }
        this.state = state;
    }

    setError(error) {
        this.error = error;
        this.setState(states.FAILED);
    }

    failed() {
        this.setState(states.FAILED);
    }

    toString() {
        return "<Link(" + this.url + ", " + this.state + ")>";
    }

    clone() {
        let fields = [
            'state',
            'progress',
            'total',
            'onProgress',
            'onState',
            'error',
            'type',
            'selected',
            'img'
        ];
        let link = new Link(this.id, this.url);
        for (let field of fields) {
            link[field] = this[field];
        }

        return link;
    }
}


class Group {
    constructor(id, title, links) {
        this.id = id;
        this.title = title;
        this.links = links;
        this.type = "group";
    }

    clone() {
        let group = new Group(this.id, this.title, []);
        for (let link of this.links) {
            group.links.push(link.clone());
        }
        return group;
    }
}


class DownloadList {
    /**
     *
     * @param hosters An hoster.Hoster instance
     */
    constructor(/** Hosters */hosters) {
        this.hosters = hosters;

        this.downloads = [];
        this.shadowDownloads = [];

        this.groupIdToIndex = {};
        this.linkIdToIndex = {};

        this.maxConnections = 4;
        this.threads = {};
        this.downloading = {};

        this.currentId = 0;

        this.onAddLinks = null;
        this.onPauseChanged = null;

        this.paused = false;
    }

    firePauseCallback() {
        if (this.onPauseChanged) {
            this.onPauseChanged(this.paused);
        }
    }

    pause() {
        this.paused = true;
        this.firePauseCallback();
    }

    unpause() {
        this.paused = false;
        //this.processQueue();
        this.firePauseCallback();
    }

    nextId() {
        this.currentId++;
        return this.currentId;
    }

    addLinks(title, links, options) {
        let linkObjects = [];

        let groupId = this.nextId();

        for (let link of links) {

            let linkObj = new Link(this.nextId(), link.url);
            if (options.start) {
                linkObj.setState(states.WAITING);
            }
            else {
                linkObj.setState(states.DISABLED);

            }
            linkObjects.push(linkObj);

        }
        let group = new Group(groupId, title, linkObjects);

        this.shadowDownloads.push(group);

        try {
            this.downloads.push(group.clone());
        }
        catch (e) {
            if (e instanceof TypeError) {
                console.debug("[queue] write to dead object");
            }
            else {
                throw e;
            }
        }

        this.groupIdToIndex[group.id] = this.downloads.length - 1;

        for (let idx in Object.keys(linkObjects)) {
            this.linkIdToIndex[linkObjects[idx].id] = [this.downloads.length - 1, parseInt(idx)];
        }

        if (this.onAddLinks) {
            this.onAddLinks(group);
        }

        return group;
    }

    processQueue() {
        let setState = (links, state) => {
            for (let link of links) {
                try {
                    link.setState(state);
                }
                catch (e) {
                    if (e instanceof TypeError) {
                        console.warn("setState(): write to dead object");
                    }
                    else {
                        throw e;
                    }
                }
            }
        };
        let setProgress = (links, loaded, total) => {
            for (let link of links) {
                try {
                    link.updateProgress(loaded, total);
                }
                catch (e) {
                    if (e instanceof TypeError) {
                        console.warn("setProgress(): write to dead object", e);
                    }
                    else {
                        //throw e;
                    }
                }
            }
        };
        let setError = (links, error) => {
            for (let link of links) {
                try {
                    link.setError(error);
                }
                catch (e) {
                    if (e instanceof TypeError) {
                        console.warn("setError(): write to dead object");
                    }
                    else {
                        throw e;
                    }
                }
            }
        };

        for (let groupIdx in Object.keys(this.shadowDownloads)) {
            let backupGroup = this.shadowDownloads[groupIdx];
            let group = this.downloads[groupIdx];

            for (let linkIdx in Object.keys(group.links)) {
                let link = group.links[linkIdx];
                let backupLink = backupGroup.links[linkIdx];

                if (Object.keys(this.downloading).length >= this.maxConnections) {
                    return;
                }

                if (backupLink.state === states.WAITING) {
                    let hoster = this.hosters.getHoster(backupLink.url);
                    if (hoster.maxThreads) {
                        let connections = Object.values(this.downloading).filter((id) => {
                            return id === hoster.id
                        }).length;
                        if (connections >= hoster.maxThreads) {
                            continue;
                        }
                    }

                    setState(this.getLinks(backupLink.id), states.PARSE);
                    this.downloading[backupLink.id] = hoster.id;

                    this.hosters.getDownloadUrl(backupLink.url, {debug: false}).then(
                        (result) => {
                            let xhr = download(
                                result.imgUrl,
                                result.fileName,
                                (event) => setProgress(this.getLinks(backupLink.id), event.loaded, event.total),
                                () => {
                                    setState(this.getLinks(backupLink.id), states.FINISHED);
                                    delete(this.downloading[backupLink.id]);
                                    this.processQueue();
                                },
                                () => {
                                    setState(this.getLinks(backupLink.id), states.FAILED);
                                    delete(this.downloading[backupLink.id]);
                                    this.processQueue();
                                }
                            );
                            backupLink.attachXHR(xhr);
                            xhr.send();
                        },
                        (error) => {
                            delete(this.downloading[backupLink.id]);
                            setError(this.getLinks(backupLink.id), error);
                            this.processQueue();
                        }
                    );
                }
            }
        }
    }

    getLinks(id) {
        let [groupIdx, linkIdx] = this.linkIdToIndex[id];
        let link = this.shadowDownloads[groupIdx].links[linkIdx];
        let possibleDeadLink;
        try {
            possibleDeadLink = this.downloads[groupIdx].links[linkIdx];
        }
        catch (e) {
            if (e instanceof TypeError) {
                possibleDeadLink = link.clone();
            }
            else {
                throw e;
            }
        }
        return [
            possibleDeadLink,
            link
        ]
    }

    refresh() {
        delete(this.downloads);
        this.downloads = [];
        for (let group of this.shadowDownloads) {
            this.downloads.push(group.clone());
        }
    }

    cancel(id) {
        this.downloading[id].cancel();
        delete(this.downloading[id]);
    }

    persist() {
        browser.storage.local.set({
            downloadList: JSON.stringify(this.shadowDownloads)
        });
    }

    load() {
        browser.storage.local.get("downloadList").then((result) => {
            if (result.downloadList) {
                let groups = JSON.parse(result.downloadList);

                for (let group of groups) {
                    let addedGroup = this.addLinks(group.title, group.links, {start: false});

                    for (let i in group.links) {
                        for (let field of ["state", "progress", "total"]) {
                            addedGroup.links[i][field] = group.links[i][field];
                        }
                    }
                }
            }
        })
    }

    test() {
        let testData = {
            "id": 23,
            "title": "PHOTOSHOOT - Sarah Shahi - John Russo photoshoot for Men's Edge magazine, June 2005 | Phun.org Forum",
            "links": [{
                "id": 2,
                "url": "https://pixhost.org/show/298/47597211_sarah_shahi-men-s_edge_-john_russo-june_2005_1.jpg",
                "state": "waiting",
                "progress": 0,
                "total": 0,
                "xhr": null,
                "onProgress": null,
                "onState": null,
                "error": null
            }, {
                "id": 4,
                "url": "https://pixhost.org/show/298/47597214_sarah_shahi-men-s_edge_-john_russo-june_2005_2.jpg",
                "state": "waiting",
                "progress": 0,
                "total": 0,
                "xhr": null,
                "onProgress": null,
                "onState": null,
                "error": null
            }, {
                "id": 6,
                "url": "https://pixhost.org/show/298/47597217_sarah_shahi-men-s_edge_-john_russo-june_2005_3.jpg",
                "state": "waiting",
                "progress": 0,
                "total": 0,
                "xhr": null,
                "onProgress": null,
                "onState": null,
                "error": null
            }, {
                "id": 8,
                "url": "https://pixhost.org/show/298/47597220_sarah_shahi-men-s_edge_-john_russo-june_2005_4.jpg",
                "state": "waiting",
                "progress": 0,
                "total": 0,
                "xhr": null,
                "onProgress": null,
                "onState": null,
                "error": null
            }, {
                "id": 10,
                "url": "https://pixhost.org/show/298/47597227_sarah_shahi-men-s_edge_-john_russo-june_2005_5.jpg",
                "state": "waiting",
                "progress": 0,
                "total": 0,
                "xhr": null,
                "onProgress": null,
                "onState": null,
                "error": null
            }, {
                "id": 12,
                "url": "https://pixhost.org/show/298/47597236_sarah_shahi-men-s_edge_-john_russo-june_2005_6.jpg",
                "state": "waiting",
                "progress": 0,
                "total": 0,
                "xhr": null,
                "onProgress": null,
                "onState": null,
                "error": null
            }, {
                "id": 14,
                "url": "https://pixhost.org/show/298/47597242_sarah_shahi-men-s_edge_-john_russo-june_2005_7.jpg",
                "state": "waiting",
                "progress": 0,
                "total": 0,
                "xhr": null,
                "onProgress": null,
                "onState": null,
                "error": null
            }, {
                "id": 16,
                "url": "https://pixhost.org/show/298/47597247_sarah_shahi-men-s_edge_-john_russo-june_2005_8.jpg",
                "state": "waiting",
                "progress": 0,
                "total": 0,
                "xhr": null,
                "onProgress": null,
                "onState": null,
                "error": null
            }, {
                "id": 18,
                "url": "https://pixhost.org/show/298/47597252_sarah_shahi-men-s_edge_-john_russo-june_2005_9.jpg",
                "state": "waiting",
                "progress": 0,
                "total": 0,
                "xhr": null,
                "onProgress": null,
                "onState": null,
                "error": null
            }, {
                "id": 20,
                "url": "https://pixhost.org/show/298/47597257_sarah_shahi-men-s_edge_-john_russo-june_2005_10.jpg",
                "state": "waiting",
                "progress": 0,
                "total": 0,
                "xhr": null,
                "onProgress": null,
                "onState": null,
                "error": null
            }, {
                "id": 22,
                "url": "https://pixhost.org/show/298/47597268_sarah_shahi-men-s_edge_-john_russo-june_2005_11.jpg",
                "state": "waiting",
                "progress": 0,
                "total": 0,
                "xhr": null,
                "onProgress": null,
                "onState": null,
                "error": null
            }]
        };

        this.addLinks("Test 1", testData.links, {start:false});

        this.addLinks("Test 2", testData.links, {start:false});

        this.addLinks("Test 3", testData.links, {start:false});
    }
}

export {
    DownloadList
}