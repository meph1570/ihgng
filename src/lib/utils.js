
class SelectionModel {
    constructor(groupCountGetter, itemCountGetter) {
        this.selection = {};
        this.lastItemIdx = null;
        this.lastGroupIdx = null;

        this.groupCountGetter = groupCountGetter;
        this.itemCountGetter = itemCountGetter;
    }

    clear() {
        this.selection = {};
    }

    isSelected(groupIdx, itemIdx) {
        return `${groupIdx}:${itemIdx}` in this.selection;
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
                let revoker = (delta) => {
                    if (delta && delta.id === downloadId && delta.state.current === "complete") {
                        window.URL.revokeObjectURL(url);
                        browser.downloads.onChanged.removeListener(revoker);
                        browser.downloads.erase({id: downloadId});
                    }
                };
                browser.downloads.onChanged.addListener(revoker);
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
        console.debug("[download] Error fetching", url, e);
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