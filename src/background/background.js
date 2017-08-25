/*const HOSTFILE_REFRESH = 3600 * 1000;
const HOSTFILE_URL = "***REMOVED***share/hostf.xml";

let hosters = {};
let matchedHosters = {};*/

function handleMessage(request, sender, sendResponse) {
    console.log("Message from the content script:", request, sender);
    console.log(request.start, request.links);

    if (request.action === "close") {
        browser.tabs.remove(sender.tab.id);
    }
    else if (request.action === "links") {
        let links = request.links.filter((link) => getHoster(link.url));

        if (request.start) {
            console.log("Filtering links");
            console.debug("Starting", links);
            downloadList.addLinks(sender.tab.title, links, {start: true});
            console.debug("Done");
        }
        else {
            openLinkSelect(links);
        }
    }
    else {
        console.error("Unknown action received: ", request);
        console.error("Sender: ", sender);
    }
}


function collectLinks(start) {
    browser.tabs.executeScript(null, {
        code: "__IHG_START_IMMEDIATELY = " + start.toString() + ";"
    });
    browser.tabs.executeScript(null, {
        file: "/content_scripts/collect_links.js",
    });
}

/*
function urlJoin(part1, part2) {
    let rgxHost = /(https?:\/\/[^/]+)/;
    let baseUrl = part1.match(rgxHost)[1];
    if (!part2.startsWith("/")) {
        baseUrl += "/";
    }
    return baseUrl + part2;
}


function download(url, filename, progress, success, failure) {
    let xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);

    xhr.responseType = "blob";
    xhr.onprogress = progress;

    xhr.onload = function (e) {
        if (this.status === 200) {
            let blob = this.response;
            let url = window.URL.createObjectURL(blob);
            browser.downloads.download({url: url, filename: filename}).then((downloadId) => {
                browser.downloads.erase({id: downloadId});
            });
            success();
        }
    };

    xhr.onerror = function (e) {
        alert("Error " + e.target.status + " occurred while receiving the document.");
        failure();
    };

    //xhr.send();
    return xhr;
}

function downloadHostFile(url) {
    return new Promise((resolve, reject) => {
        let xhr = new XMLHttpRequest();
        xhr.open("GET", url, true);

        xhr.onload = function (e) {
            if (this.status === 200) {
                let content = this.response;
                browser.storage.local.set({
                    "lastHostFileSync": new Date().getTime(),
                    "hostfile": content
                });
                resolve(content);
            }
            else {
                reject();
            }
        };
        xhr.onerror = function (e) {
            reject();
        };
        xhr.send();
    });
}


function loadHostFile(url) {
    return new Promise((resolve, reject) => {
        console.debug("Checking hostfile");
        browser.storage.local.get("lastHostFileSync").then(
            (result) => {
                console.debug(result);
                let now = new Date().getTime();
                if (result.lastHostFileSync) {
                    if (now - result.lastHostFileSync > HOSTFILE_REFRESH) {
                        console.debug("Cache expired", now - result["lastHostFileSync"]);
                        downloadHostFile(url).then(
                            (hostfile) => resolve(hostfile),
                            () => reject()
                        );
                    }
                    else {
                        // Use from cache
                        console.debug("Cache up to date");
                        browser.storage.local.get("hostfile").then(
                            (result) => result.hostfile
                        )
                            .then((hostfile) => resolve(hostfile));
                    }
                }
                else {
                    console.debug("First run");
                    downloadHostFile(url).then(
                        (hostfile) => resolve(hostfile),
                        () => reject()
                    );

                }
            },
        )
    });
}


function getPageDOM(url) {
    return new Promise((resolve, reject) => {
        let xhr = new XMLHttpRequest();
        xhr.open("GET", url, true);
        xhr.onload = function (e) {
            let html = this.response;
            let parser = new DOMParser();
            let doc = parser.parseFromString(html, "text/html");
            resolve({document: doc, html: html});
        };
        xhr.onerror = () => reject();
        xhr.send();
    });
}


function parseHostFile(hostfile) {
    console.log("Parsing hostfile");
    let parser = new DOMParser();
    let doc = parser.parseFromString(hostfile, "application/xml");
    let result = doc.evaluate(".//host", doc, null, XPathResult.ANY_TYPE, null);

    let currentNode = result.iterateNext();
    let i = 0;
    let errors = 0;

    if (!currentNode) {
        return false;
    }

    while (currentNode) {
        let urlPattern = currentNode.getElementsByTagName("urlpattern")[0];
        let searchPattern = currentNode.getElementsByTagName("searchpattern")[0];

        let urlRegexp = new RegExp(urlPattern.firstChild.data);
        let searchExpr = searchPattern.firstChild.data;
        let parseFunc = null;

        if (searchExpr.startsWith("function")) {
            let funcStr = "(function getFunc() { return " + searchExpr + "})();";
            let func = null;
            try {
                func = eval(funcStr);
            } catch (e) {
                func = null;
                errors++;
                console.error("Hoster invalid:", currentNode.id);
            }
            parseFunc = function (document) {
                return func
            }
        }
        else if (searchExpr.startsWith('"ID:')) {
            let picId = searchExpr.match(/"ID: (.+)"/)[1];
            parseFunc = function (document) {
                console.log("!!", document);
                return function (pageData, pageUrl) {
                    let src;
                    try {
                        src = document.querySelector("#" + picId).src;
                    }
                    catch (e if e instanceof SyntaxError) {
                        return {
                            imgUrl: null,
                            status: "ABORT",
                            debug: "Invalid selector: #" + picId
                        }
                    }
                    if (src === null) {
                        return {
                            imgUrl: null,
                            status: "ABORT",
                            debug: "Selector didn't match"
                        }
                    }
                    else {
                        return {
                            imgUrl: src,
                            status: "OK"
                        }
                    }
                }
            }
        }
        else if (searchExpr.startsWith('"REPLACE:')) {
            let m = searchExpr.match(/REPLACE: ('|")(.*)\1.*,.*('|")(.*)\3/);
            let rgx = new RegExp(m[2]);
            let replace = m[4];

            parseFunc = function (document) {
                return function (pageData, pageUrl) {
                    return {
                        imgUrl: pageUrl.replace(rgx, replace),
                        status: "OK"
                    }
                }
            }
        }
        else if (searchExpr.startsWith('"QUERYSELECTOR:')) {
            let qs = searchExpr.match(/"QUERYSELECTOR: (.+)"$/)[1];

            parseFunc = function (document) {
                return function (pageData, pageUrl) {
                    let imgUrl = null;
                    let $el = document.querySelector(qs);
                    if ($el !== null) {
                        if ($el.tagName === "A") {
                            imgUrl = $el.href;
                        }
                        else if ($el.tagName === "IMG") {
                            imgUrl = $el.src;
                        }
                        else {
                            return {
                                status: "ABORT",
                                imgUrl: null,
                                debug: "Can only select <a /> or <img /> elements. Tag: " + $el.tagName
                            }
                        }
                    }
                    else {
                        return {
                            status: "ABORT",
                            imgUrl: null,
                            debug: "No element found. Selector: " + qs
                        }
                    }

                    return {
                        imgUrl: imgUrl,
                        status: "OK"
                    }
                }
            }
        }
        else {
            let rgx = new RegExp(searchExpr.substr(1, searchExpr.length - 2));
            parseFunc = function (document) {
                return function (pageData, pageUrl) {
                    for (let element of document.querySelectorAll("img")) {
                        if (element.outerHTML.match(rgx)) {
                            return {
                                imgUrl: element.src,
                                status: "OK"
                            }
                        }
                    }
                    return {
                        imgUrl: null,
                        status: "ABORT"
                    }
                }
            }
        }

        hosters[currentNode.id] = {
            id: currentNode.id,
            pattern: urlRegexp,
            parseFunc: parseFunc
        };

        currentNode = result.iterateNext();
        i++;
    }

    console.debug(i, "hoster loaded,", errors, "errors");
}


function getHoster(url) {
    let match = (collection) => {
        for (let hostId in collection) {
            let hoster = collection[hostId];
            if (url.match(hoster.pattern)) {
                return hoster;
            }
        }
        return null;
    };

    let hoster = match(matchedHosters);

    if (hoster === null) {
        hoster = match(hosters);

        if (hoster !== null) {
            delete(hosters[hoster.id]);
            matchedHosters[hoster.id] = hoster;
        }
    }

    return hoster;
}


function iterateSteps(hoster, currentUrl, iterations) {
    return new Promise((resolve, reject) => {
        getPageDOM(currentUrl).then((result) => {
            let doc = result.document;
            let html = result.html;
            let parseResult = hoster.parseFunc(doc)(html, currentUrl);
            console.log(iterations, parseResult);
            iterations++;

            if (parseResult.status === "ABORT") {
                reject({
                    msg: "Hoster failed",
                    context: parseResult
                });
                return;
            }
            else if (parseResult.status === "OK") {
                resolve(parseResult);
                return;
            }

            if (iterations < 16) {
                iterateSteps(hoster, parseResult.imgUrl, iterations);
            }
            else {
                reject({msg: "Max iterations reached"});
            }
        });

    });
}


function getDownloadUrl(url) {
    return new Promise((resolve, reject) => {
        let hoster = getHoster(url);
        if (hoster !== null) {
            let currentUrl = url;
            let iterations = 0;

            iterateSteps(hoster, currentUrl, iterations).then(
                (result) => {
                    if (!result.imgUrl.startsWith("http://") && !result.imgUrl.startsWith("https://")) {
                        result.imgUrl = urlJoin(url, result.imgUrl);
                    }
                    let fileName;
                    if (result.fileName) {
                        fileName = result.fileName;
                    }
                    else {
                        let urlParts = result.imgUrl.split("/");
                        fileName = urlParts[urlParts.length - 1].replace(/[^a-zA-Z0-9-_ .]/g, "_");
                    }
                    console.log("Image url found", result);
                    resolve({
                        imgUrl: result.imgUrl,
                        fileName: fileName
                    });
                },
                (error) => {
                    console.error(error);
                    reject(error)
                }
            );
        }
    });
}


function init() {
    browser.browserAction.onClicked.addListener(handleClick);
    browser.runtime.onMessage.addListener(handleMessage);

    loadHostFile(HOSTFILE_URL).then(
        parseHostFile,
        console.error
    );
}


/*
let states = {
    WAITING: "waiting",
    DOWNLOADING: "downloading",
    FAILED: "failed",
    CANCELLED: "cancelled",
    DISABLED: "disabled",
    FINISHED: "finished",
    PARSE: "parse"
};
*/
/*
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
        console.log(this);
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
    constructor() {
        this.downloads = [];
        this.shadowDownloads = [];

        this.groupIdToIndex = {};
        this.linkIdToIndex = {};

        this.maxConnections = 4;
        this.threads = {};
        this.downloading = {};

        this.currentId = 0;

        this.onAddLinks = null;

        this.paused = false;
    }

    pause() {
        this.paused = true;
    }

    unpause() {
        this.paused = false;
        this.processQueue();
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

        this.downloads.push(group);
        this.shadowDownloads.push(group.clone());

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
                catch (e if e instanceof TypeError) {
                    console.warn("setState(): write to dead object");
                }
            }
        };
        let setProgress = (links, loaded, total) => {
            for (let link of links) {
                try {
                    link.updateProgress(loaded, total);
                }
                catch (e if e instanceof TypeError) {
                    console.warn("setProgress(): write to dead object", e);
                }
            }
        };
        let setError = (links, error) => {
            for (let link of links) {
                try {
                    link.setError(error);
                }
                catch (e if e instanceof TypeError) {
                    console.warn("setError(): write to dead object");
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
                if (link.state === states.WAITING) {
                    link.setState(states.PARSE);
                    this.downloading[link.id] = link;

                    getDownloadUrl(link.url).then(
                        (result) => {
                            let xhr = download(
                                result.imgUrl,
                                result.fileName,
                                (event) => setProgress(this.getLinks(backupLink.id), event.loaded, event.total),
                                () => {
                                    //link.setState(states.FINISHED);
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
                            delete(this.downloading[link.id]);
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
        return [
            this.downloads[groupIdx].links[linkIdx],
            this.shadowDownloads[groupIdx].links[linkIdx]
        ]
    }

    select(id) {
        for (let link of this.getLinks(id)) {
            try {
                link.selected = true;
            }
            catch (e if e instanceof TypeError) {

            }
        }
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
*/

                /*
                //this.selection = {};
                let selection = this.selection;
                this.selection = {};

                for (let k in selection) {
                    this.selection[parseInt(k)] = true;
                }

                if (!event.shiftKey && !event.ctrlKey) {
                    this.selection = {};
                    //this.selection[this.lastSelected] = false;
                    this.selection[nodeData.id] = true;
                    nodeData.selected = true;
                }

                if (event.ctrlKey) {
                    if (nodeData.id in this.selection) {
                        delete(this.selection[nodeData.id]);
                        //this.selection[nodeData.id] = false;
                        nodeData.selected = false;
                    }
                    else {
                        this.selection[nodeData.id] = true;
                        nodeData.selected = true;
                    }
                }

                if (event.shiftKey) {
                    // Select from lastSelection to this

                    let [fromId, toId] = [this.lastSelected, nodeData.id].sort((a,b) => a - b);
                    let fromGroup = null;
                    let toGroup = null;

                    if (!(fromId in downloadList.linkIdToIndex)) {
                        // Group
                        fromGroup = fromId;
                        fromId = downloadList.downloads[downloadList.groupIdToIndex[fromId]].links[0].id;
                    }

                    if (!(toId in downloadList.linkIdToIndex)) {
                        let links = downloadList.downloads[downloadList.groupIdToIndex[toId] - 1].links;

                        toGroup = toId;
                        toId = links[links.length - 1].id;
                    }

                    let [srcGroupIdx, srcLinkIdx] = downloadList.linkIdToIndex[fromId];
                    let [dstGroupIdx, dstLinkIdx] = downloadList.linkIdToIndex[toId];

                    console.log("Shiftkey", fromId, toId, srcGroupIdx, srcLinkIdx, dstGroupIdx, dstLinkIdx);

                    for (let i = srcGroupIdx; i <= dstGroupIdx; i++) {
                        let group = downloadList.downloads[i];
                        let startLinkIdx = srcGroupIdx === dstGroupIdx || i === srcGroupIdx ? srcLinkIdx : 0;
                        let endLinkIdx = srcGroupIdx === dstGroupIdx || i === dstGroupIdx ? dstLinkIdx : group.links.length - 1;

                        for (let j = startLinkIdx; j <= endLinkIdx; j++) {

                            group.links[j].selected = true;
                            this.selection[group.links[j].id] = true;
                        }
                        srcLinkIdx = 0;
                    }

                    for (let groupId of [fromGroup, toGroup]) {
                        if (groupId) {
                            this.selection[groupId] = true;
                        }
                    }
                    console.log(this.selection);
                }

                this.lastSelected = nodeData.id;

                let $root = treeNode.$root.$el;

                $root.querySelectorAll(".el-tree-node__content.selected").forEach(
                    (e) => e.classList.remove("selected")
                );

                for (let id in this.selection) {
                    let $e = $root.querySelector("[data-id='" + id + "']");
                    let $parent = $e.parentElement;
                    $parent.classList.add("selected");
                }
                */
function getDownloadList() {
    return downloadList;
}

init();

let downloadList = new DownloadList();
//downloadList.test();