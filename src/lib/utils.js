/*
                let event = this.event;

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

                console.log(this.selection, this.lastSelected);
                this.event = null;
 */


class SelectionModel {
    constructor(groupCountGetter, itemCountGetter) {
        this.selection = {};
        this.lastItemIdx = null;
        this.lastGroupIdx = null;

        this.groupCountGetter = groupCountGetter;
        this.itemCountGetter = itemCountGetter;
    }

    selectAll(includeGroups=false) {
        let totalItems = 0;
        for (let groupIdx = 0; groupIdx < this.groupCountGetter(); groupIdx++) {
            totalItems += this.itemCountGetter(groupIdx);
            if (includeGroups) {
                totalItems++;
            }
        }

        if (Object.keys(this.selection).length === totalItems) {
            this.selection = {};

            if (this.lastItemIdx !== null && this.lastGroupIdx !== null) {
                this.selectSingle(this.lastItemIdx, this.lastGroupIdx);
            }
            else {
                this.selectSingle(0, 0);
            }
        }
        else {
            for (let groupIdx = 0; groupIdx < this.groupCountGetter(); groupIdx++) {
                for (let itemIdx = 0; itemIdx < this.itemCountGetter(groupIdx); itemIdx++) {
                    this.selection[`${groupIdx}:${itemIdx}`] = true;
                }
                if (includeGroups) {
                    this.selection[`${groupIdx}:-1`] = true;
                }
            }
        }
    }

    selectSingle(groupIdx, itemIdx) {
        this.selection = {};
        this.selection[`${groupIdx}:${itemIdx}`] = true;

        this.lastItemIdx = itemIdx;
        this.lastGroupIdx = groupIdx;

        return this.selection;
    }

    selectAppend(groupIdx, itemIdx) {
        if (`${groupIdx}:${itemIdx}` in this.selection) {
            delete(this.selection[`${groupIdx}:${itemIdx}`]);
        }
        else {
            this.selection[`${groupIdx}:${itemIdx}`] = true;
        }

        this.lastItemIdx = itemIdx;
        this.lastGroupIdx = groupIdx;

        return this.selection;
    }

    selectRange(dstGroupIdx, dstLinkIdx) {
        let srcLinkIdx = this.lastItemIdx;
        let srcGroupIdx = this.lastGroupIdx;

        console.log("selectRange", srcGroupIdx, srcLinkIdx, dstGroupIdx, dstLinkIdx);

        if ((srcGroupIdx === dstGroupIdx && srcLinkIdx > dstLinkIdx) || (srcGroupIdx > dstGroupIdx)) {
            let [tmpGroupIdx, tmpLinkIdx] = [srcGroupIdx, srcLinkIdx];
            [srcGroupIdx, srcLinkIdx] = [dstGroupIdx, dstLinkIdx];
            [dstGroupIdx, dstLinkIdx] = [tmpGroupIdx, tmpLinkIdx];
        }

        for (let groupIdx = srcGroupIdx; groupIdx <= dstGroupIdx; groupIdx++) {
            let startLinkIdx = srcGroupIdx === dstGroupIdx || groupIdx === srcGroupIdx ? srcLinkIdx : 0;
            let endLinkIdx = srcGroupIdx === dstGroupIdx || groupIdx === dstGroupIdx ? dstLinkIdx : this.itemCountGetter(groupIdx) - 1;

            if (Number.isNaN(endLinkIdx)) {
                throw new Error("Invalid group length");
            }

            for (let linkIdx = startLinkIdx; linkIdx <= endLinkIdx; linkIdx++) {
                this.selection[`${groupIdx}:${linkIdx}`] = true;
            }

            if (groupIdx !== srcGroupIdx && groupIdx < dstGroupIdx) {
                this.selection[`${groupIdx}:-1`] = true;
            }

            srcLinkIdx = 0;
        }

        console.log(this.selection);

        return this.selection;
    }

    getSelection() {
        return Object.keys(this.selection).map((p) => p.split(":").map((value) => parseInt(value)));
    }
}


function humanFileSize(size) {
    if (size === 0) {
        return "0B";
    }
    const i = Math.floor(Math.log(size) / Math.log(1024));
    return ( size / Math.pow(1024, i) ).toFixed(2) * 1 + ' ' + ['B', 'kB', 'MB', 'GB', 'TB'][i];
}


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
        else {
            failure({
                httpStatus: this.status
            })
        }
    };

    xhr.onerror = function (e) {
        alert("Error " + e.target.status + " occurred while receiving the document.");
        failure({
            httpStatus: e.target.status
        });
    };
    return xhr;
}



let states = {
    WAITING: "waiting",
    DOWNLOADING: "downloading",
    FAILED: "failed",
    CANCELLED: "cancelled",
    DISABLED: "disabled",
    FINISHED: "finished",
    PARSE: "parse"
};

export {
    SelectionModel,
    download,
    humanFileSize,
    urlJoin,
    states
}