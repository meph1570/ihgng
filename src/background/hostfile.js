/**
 *
 * @source: background/hostfile.js
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
            if (e.target.status === 200) {
                let html = this.response;
                let parser = new DOMParser();
                let doc = parser.parseFromString(html, "text/html");
                resolve({document: doc, html: html});
            }
            else {
                reject({httpStatus: e.target.status});
            }
        };
        xhr.onerror = (e) => {
            console.debug("[download] Can't fetch", url, e);
            reject(e);
        };
        xhr.send();
    });
}


function makeParseFunc(searchExpr, errorRegex) {
    let parseFunc;

    const checkError = (pageData) => {
        if (!errorRegex) {
            return false;
        }

        if (pageData.match(errorRegex)) {
            return {
                imgUrl: null,
                status: "ABORT",
                debug: "Error regex matched: " + errorRegex.toString()
            }
        }

        return false;
    };

    if (searchExpr.startsWith("function")) {
        let funcStr = "(function getFunc() { return " + searchExpr + "})();";
        parseFunc = function () {
            return funcStr;
        };
        parseFunc.sandboxed = true;
    }
    else if (searchExpr.startsWith('"ID:')) {
        let picId = searchExpr.match(/"ID: (.+)"/)[1];
        parseFunc = function (document) {
            return function (pageData, pageUrl) {
                let error = checkError(pageData);
                if (error) {
                    return error;
                }

                let src;
                try {
                    src = document.getElementById(picId);
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
                        imgUrl: src.attributes.src.value,
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
                let error = checkError(pageData);
                if (error) {
                    return error;
                }

                let imgUrl = null;
                let $el = document.querySelector(qs);
                if ($el !== null) {
                    if ($el.tagName === "A") {
                        imgUrl = $el.attributes.href.value;
                    }
                    else if ($el.tagName === "IMG") {
                        imgUrl = $el.attributes.src.value;
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
                let error = checkError(pageData);
                if (error) {
                    return error;
                }
                for (let element of document.querySelectorAll("img")) {
                    if (element.outerHTML.match(rgx)) {
                        return {
                            imgUrl: element.attributes.src.value,
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


function makeFileNameFunc(mode, regex, replace) {
    return function (filename, pageData) {
        let thing = mode === "filename" ? filename : pageData;

        if (!thing.match(regex)) {
            console.debug("[hostfile] No match", {mode, thing, regex, replace});
            return filename;
        }

        if (mode === "filename") {
            return filename.replace(regex, replace);
        }
        else if (mode === "content") {
            let matches = pageData.match(regex);
            return replace.replace(/(\$(\d))/g, (m1, m2, index) => matches[index])
        }
        else {
            console.error("[hostfile] Invalid filename mode");
            return filename;
        }
    };
}

function isValidFileNamePattern(filenamepattern) {
    for (let field of ["mode", "pattern", "filename"]) {
        if (filenamepattern[field] === null || filenamepattern[field] === undefined) {
            return false;
        }
    }
    return true;
}

function makeFileNameFuncFromObject(filenamepattern) {
    if (!isValidFileNamePattern(filenamepattern)) {
        return null;
    }

    return makeFileNameFunc(filenamepattern.mode, new RegExp(filenamepattern.pattern), filenamepattern.filename);
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
        let errorPattern = currentNode.getElementsByTagName("errorpattern")[0];
        let fileNamePattern = currentNode.getElementsByTagName("filenamepattern")[0];

        let urlRegexp = new RegExp(urlPattern.firstChild.data);
        let errorRegexp = errorPattern ? new RegExp(errorPattern.firstChild.data) : null;
        let fileNameFunc = null;
        if (fileNamePattern) {
            fileNameFunc = makeFileNameFunc(
                fileNamePattern.attributes.mode.value,
                new RegExp(fileNamePattern.firstChild.data),
                fileNamePattern.attributes.filename.value
            );
        }

        let searchExpr = searchPattern.firstChild.data;
        let parseFunc = makeParseFunc(searchExpr, errorRegexp);

        let maxThreads = parseInt(currentNode.attributes.maxThreads ? currentNode.attributes.maxThreads.value : 0);

        let hoster = {
            id: currentNode.id,
            pattern: urlRegexp,
            parseFunc: parseFunc,
            fileNameFunc: fileNameFunc,
            source: source,
            maxThreads: maxThreads
        };

        if (options.debug) {
            Object.assign(hoster, {
                "searchpattern": searchPattern.textContent,
                "urlpattern": urlPattern.textContent,
                "errorpattern": errorPattern ? errorPattern.textContent : null,
                "filenamepattern": fileNamePattern ? {
                    "pattern": fileNamePattern.textContent,
                    "mode": fileNamePattern.attributes.mode.value,
                    "filename": fileNamePattern.attributes.filename.value
                } : {}
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

    addHoster(id, urlpattern, searchpattern, errorpattern, filenamepattern) {
        this.hosters[id] = {
            id: id,
            pattern: new RegExp(urlpattern),
            parseFunc: makeParseFunc(searchpattern),
            fileNameFunc: makeFileNameFuncFromObject(filenamepattern),
            source: "storage://",
            urlpattern: urlpattern,
            searchpattern: searchpattern,
            errorpattern: errorpattern,
            filenamepattern: filenamepattern
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

        if (hoster.errorpattern) {
            let $errorPattern = doc.createElement("errorpattern");
            $errorPattern.appendChild(document.createTextNode(hoster.errorpattern));

            $host.appendChild($errorPattern);
        }

        if (isValidFileNamePattern(hoster.filenamepattern)) {
            let $fileNamePattern = doc.createElement("filenamepattern");
            $fileNamePattern.appendChild(document.createTextNode(hoster.filenamepattern.pattern));
            $fileNamePattern.setAttribute("mode", hoster.filenamepattern.mode);
            $fileNamePattern.setAttribute("filename", hoster.filenamepattern.filename);

            $host.appendChild($fileNamePattern);
        }

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

        this.worker = new Worker("/worker/index.js");
        this.worker.onmessage = this.onWorkerMessage.bind(this);
        this.worker.onerror = this.onWorkerError.bind(this);
        this.workerResults = new Map();

        this.callId = 0;

    }

    onWorkerMessage(e) {
        let [callId, parseResult] = e.data;

        this.workerResults.get(callId).resolve(parseResult);
        this.resetWorkerResult(callId);
    }

    onWorkerError(e) {
        if (e.callId) {
            console.error("[hoster] Worker failed:", e);
            if (this.workerResults.has(e.callId)) {
                this.workerResults.get(e.callId).reject(e);
                this.resetWorkerResult(e.callId);
            }
            else {
                console.warn("[hoster] Worker failed, callId not in workerResults");
            }
        }
        else {
            if (this.workerResults.size) {
                console.warn("[hoster] Worker failed, no callId supplied", e);
            }
        }
    }

    resetWorkerResult(callId) {
        this.workerResults.delete(callId);
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
                console.error("[hostfile] Error fetching hostfile: ", url, e);
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
                        searchpattern: hoster.searchpattern,
                        errorpattern: hoster.errorpattern,
                        filenamepattern: hoster.filenamepattern
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

        await this.load(this.urls, {force: true});
    }

    async testHoster(id, urlpattern, searchpattern, errorpattern, filenamepattern, url) {
        let hosters = new Hosters();
        await hosters.load(this.urls);

        let pattern = new RegExp(urlpattern);
        let patternMatches = url.match(pattern) !== null;

        let errorRegex = null;
        if (errorpattern) {
            errorRegex = new RegExp(errorpattern);
        }

        let result = null;
        let log = [];

        if (patternMatches) {
            let parseFunc = makeParseFunc(searchpattern, errorRegex);
            let fileNameFunc = makeFileNameFuncFromObject(filenamepattern);

            hosters.hosters[id] = {
                id: id,
                pattern: pattern,
                parseFunc: parseFunc,
                fileNameFunc: fileNameFunc,
                temp: true
            };


            console.xlog = (s) => {
                if (s instanceof Object) {
                    s = JSON.stringify(s, null, 4);
                }
                log.push(s.toString());
            };

            result = await hosters.getDownloadUrl(url, {debug: true});
            // TODO
            if (!result) {
                throw new Error();
            }

            console.xlog = null;
        }
        else {
            throw new HosterError("Pattern doesn't match");
        }

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
                let result;

                try {
                    result = await getPageDOM(currentUrl);
                }
                catch (e) {
                    return {imgUrl: null, error: e, fileName: null};
                }

                let {html, document} = result;

                let parseResult;
                if (hoster.parseFunc.sandboxed) {
                    let callId = this.callId++;

                    let parsing = new Promise((resolve, reject) => {
                        this.worker.postMessage([hoster.parseFunc(), html, currentUrl, callId]);
                        this.workerResults.set(callId, {resolve, reject});
                    });

                    try {
                        parseResult = await parsing;
                    }
                    catch (e) {
                        throw new HosterError(`Hoster ${hoster.id} failed. Sandboxed execution error`, e);
                    }
                }
                else {
                    parseResult = hoster.parseFunc(document)(html, currentUrl);
                }

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

                    if (hoster.fileNameFunc !== null) {
                        fileName = hoster.fileNameFunc(fileName, html);
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