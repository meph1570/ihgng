import {HOSTFILE_DEFAULT_TIMEOUT} from "../lib/globals";
import {urlJoin} from "../lib/utils";


function downloadHostFile(url) {
    return new Promise((resolve, reject) => {
        let xhr = new XMLHttpRequest();
        xhr.open("GET", url, true);

        xhr.onload = function (e) {
            if (this.status === 200) {
                let content = this.response;

                let storageHostFile = {};
                storageHostFile[`hostfile:${url}`] = {
                    lastSync: new Date().getTime(),
                    content: content
                };
                browser.storage.local.set(storageHostFile);
                resolve(content);
            }
            else {
                reject();
            }
        };
        xhr.onerror = function (e) {
            reject();
        };

        console.debug("[hostfile] Downloading", url);

        xhr.send();
    });
}


function loadHostFile(url, options={}) {
    let storageKey = `hostfile:${url}`;
    return new Promise((resolve, reject) => {
        browser.storage.local.get(storageKey).then(
            (result) => {
                let now = new Date().getTime();
                if (result[storageKey]) {
                    let {lastSync, content} = result[storageKey];
                    if (now - lastSync > HOSTFILE_DEFAULT_TIMEOUT || options.force) {
                        console.debug("[hostfile] Cache expired or forced", now - lastSync);
                        downloadHostFile(url).then(
                            (hostfile) => resolve(hostfile),
                            () => reject()
                        );
                    }
                    else {
                        // Use from cache
                        console.debug("[hostfile] Using cache");
                        resolve(content);
                    }
                }
                else {
                    console.debug("[hostfile] Cache empty");
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


function makeParseFunc(searchExpr) {
    let parseFunc;

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
            return function (pageData, pageUrl) {
                let src;
                try {
                    src = document.querySelector("#" + picId).src;
                }
                catch (e) {
                    if (e instanceof SyntaxError) {
                        return {
                            imgUrl: null,
                            status: "ABORT",
                            debug: "Invalid selector: #" + picId
                        }
                    }
                    else {
                        throw e;
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

    return parseFunc;
}


function parseHostFile(source, content, options={}) {
    console.log("[hostfile] Parsing", source);
    let hosters = {};

    let parser = new DOMParser();
    let doc = parser.parseFromString(content, "application/xml");
    let result = doc.evaluate(".//host", doc, null, XPathResult.ANY_TYPE, null);

    let currentNode = result.iterateNext();
    let i = 0;
    let errors = 0;

    while (currentNode) {
        let urlPattern = currentNode.getElementsByTagName("urlpattern")[0];
        let searchPattern = currentNode.getElementsByTagName("searchpattern")[0];

        let urlRegexp = new RegExp(urlPattern.firstChild.data);
        let searchExpr = searchPattern.firstChild.data;
        let parseFunc = makeParseFunc(searchExpr);

        /*
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
                return function (pageData, pageUrl) {
                    let src;
                    try {
                        src = document.querySelector("#" + picId).src;
                    }
                    catch (e) {
                        if (e instanceof SyntaxError) {
                            return {
                                imgUrl: null,
                                status: "ABORT",
                                debug: "Invalid selector: #" + picId
                            }
                        }
                        else {
                            throw e;
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
        }*/
        let maxThreads = parseInt(currentNode.attributes.maxThreads ? currentNode.attributes.maxThreads.value : 0);

        let hoster = {
            id: currentNode.id,
            pattern: urlRegexp,
            parseFunc: parseFunc,
            source: source,
            maxThreads: maxThreads
        };

        if (options.debug) {
            Object.assign(hoster, {
               "searchpattern": searchPattern.textContent,
               "urlpattern": urlPattern.textContent
            });
        }

        hosters[currentNode.id] = hoster;

        currentNode = result.iterateNext();
        i++;
    }

    console.debug("[hostfile]", i, "hoster loaded,", errors, "errors");

    return hosters;
}


class LocalHostFile {
    constructor(content) {
        this.content = content;
        this.hosters = {};
        this.onSave = null;
    }

    async load(options) {
        let result = await browser.storage.local.get("hostfile:storage://");
        if (result["hostfile:storage://"]) {
            this.content = result["hostfile:storage://"].content;

            options.debug = true;  // Without raw searchpattern & urlpattern are lost

            this.hosters = parseHostFile("storage://", this.content, options);
        }

        return this.hosters;
    }

    addHoster(id, urlpattern, searchpattern) {
        this.hosters[id] = {
            id: id,
            pattern: new RegExp(urlpattern),
            parseFunc: makeParseFunc(searchpattern),
            source: "storage://",
            urlpattern: urlpattern,
            searchpattern: searchpattern
        };

        this.save();

    }

    removeHoster(hosterId) {
        delete(this.hosters[hosterId]);
        this.save();
    }

    save() {
        this.content = this.dump();
        browser.storage.local.set({
            "hostfile:storage://": {
                content: this.content,
                lastSync: -1
            }
        });

        if (this.onSave !== null) {
            this.onSave(this);
        }
    }

    dump() {
        let doc = document.implementation.createDocument(null, "hostfile");
        let $root = doc.childNodes[0];

        for (let hosterId of Object.keys(this.hosters)) {
            let hoster = this.hosters[hosterId];
            let $host = this.serializeHoster(doc, hoster);
            $root.appendChild($host);
        }
        let serializer = new XMLSerializer();
        return serializer.serializeToString(doc);
    }

    serializeHoster(doc, hoster) {
        let $host = doc.createElement("host");
        $host.setAttribute("id", hoster.id);

        let $searchPattern = doc.createElement("searchpattern");
        $searchPattern.appendChild(document.createTextNode(hoster.searchpattern));

        let $urlPattern = doc.createElement("urlpattern");
        $urlPattern.appendChild(document.createTextNode(hoster.urlpattern));

        $host.appendChild($urlPattern);
        $host.appendChild($searchPattern);

        return $host;
    }
}


class HosterError extends Error {
    constructor(message, context) {
        super(message);
        this.context = context;
    }
}


class Hosters {
    constructor() {
        this.urls = [];

        this.debug = false;

        this.hosters = {};
        this.matchedHosters = {};

        this.localHostFile = new LocalHostFile("");
        this.localHostFile.onSave = () => this.reloadLocalHostFile();
    }

    parse(url, content, options) {
        Object.assign(this.hosters, parseHostFile(url, content, options))
    }

    async load(hostfiles, options={}) {
        this.urls = hostfiles;

        options.debug = this.debug;

        for (let {url, enabled} of hostfiles) {
            if (!enabled) {
                continue;
            }

            console.log("[hostfile] Processing", url);
            try {
                let content = await loadHostFile(url, options);
                this.parse(
                    url,
                    content,
                    options
                );
            }
            catch (e) {
                console.error("[hostfile] Error fetching hostfile: ", url);
            }
        }

        // Local hostfile
        Object.assign(this.hosters, await this.localHostFile.load(options));
    }

    reloadLocalHostFile() {
        console.debug("[hostfile] Reloading storage://");
        Object.assign(this.hosters, this.localHostFile.hosters);
    }

    removeHoster(hosterId) {
        if (!(hosterId in this.localHostFile.hosters)) {
            throw new Error("Only local hosts can be deleted");
        }

        this.localHostFile.removeHoster(hosterId);
        return this.reset()
    }

    getHosterList() {
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

        copyHosters(this.hosters);
        copyHosters(this.matchedHosters);

        preparedHosters.sort((a, b) => { return b.id < a.id });

        return preparedHosters;
    }

    async reset() {
        this.hosters = {};
        this.matchedHosters = {};

        await this.load(this.urls, {});
    }

    async testHoster(id, urlpattern, searchpattern, url) {
        let hosters = new Hosters();
        await hosters.load(this.urls);

        let pattern = new RegExp(urlpattern);
        let patternMatches = url.match(pattern) !== null;
        let parseFunc = makeParseFunc(searchpattern);

        hosters.hosters[id] = {
            id: id,
            pattern: pattern,
            parseFunc: parseFunc,
            temp: true
        };

        let log = [];
        console.xlog = (s) => {
            if (s instanceof Object) {
                s = JSON.stringify(s, null, 4);
            }
            log.push(s.toString());
        };

        let result = await hosters.getDownloadUrl(url, {debug: true});

        console.xlog = null;

        return {
            parseResult: result,
            patternMatches: patternMatches,
            log: log.join("\n")
        }
    }

    getHoster(url) {
        let match = (collection) => {
            for (let hostId in collection) {
                let hoster = collection[hostId];
                if (url.match(hoster.pattern)) {
                    return hoster;
                }
            }
            return null;
        };

        let hoster = match(this.matchedHosters);

        if (hoster === null) {
            hoster = match(this.hosters);

            if (hoster !== null) {
                delete(this.hosters[hoster.id]);
                this.matchedHosters[hoster.id] = hoster;
            }
        }

        return hoster;
    }

    getUrlOrRedirect(url) {
        let hoster = this.getHoster(url);

        if (hoster === null) {
            // Try to find a second url in url
            let match = decodeURIComponent(url).match(/https?:\/\/.+?(https?:\/\/.+)/);
            if (match) {
                hoster = this.getHoster(match[1]);
                if (hoster !== null) {
                    return match[1];
                }
            }
        }
        else {
            return url;
        }
        return null;
    }

    async getDownloadUrl(url, {debug}) {
        let hoster = this.getHoster(url);

        if (hoster !== null) {
            let currentUrl = url;
            let iterations = 0;

            while (iterations < 16) {
                let {document, html} = await getPageDOM(currentUrl);

                let parseResult = hoster.parseFunc(document)(html, currentUrl);
                iterations++;



                if (debug) {
                    console.log("[hoster] getDownloadUrl", iterations, parseResult);
                }

                if (parseResult.status === "ABORT") {
                    parseResult.currentUrl = currentUrl;
                    parseResult.url = url;
                    throw new HosterError(`Hoster '${hoster.id}' failed`, parseResult);
                }
                else if (parseResult.status === "OK") {
                    if (!parseResult.imgUrl.startsWith("http://") && !parseResult.imgUrl.startsWith("https://")) {
                        parseResult.imgUrl = urlJoin(url, parseResult.imgUrl);
                    }

                    let fileName;
                    if (parseResult.fileName) {
                        fileName = parseResult.fileName;
                    }
                    else {
                        let urlParts = parseResult.imgUrl.split("/");
                        fileName = urlParts[urlParts.length - 1].replace(/[^a-zA-Z0-9-_ .]/g, "_");
                    }

                    return {
                        imgUrl: parseResult.imgUrl,
                        fileName: fileName
                    };
                }
                else if (parseResult.status === "REQUEUE") {
                    // Loop starts over, maybe with different host and url
                    currentUrl = parseResult.imgUrl;
                    hoster = this.getHoster(currentUrl);
                }
                else {
                    throw new HosterError(`Hoster '${hoster.id}' failed. Invalid status ${parseResult.status}`, null);
                }

                throw new HosterError(`Hoster '${hoster.id}' failed. Max iterations reached`, null);
            }
        }
    }
}

export {
    Hosters,
    HosterError
}