import Vue from 'vue'

import ElementUI from 'element-ui'
import 'element-ui/lib/theme-default/index.css'

import App from './App.vue'

Vue.use(ElementUI);

//browser.extension.getBackgroundPage().getDownloadList().refresh();

let vm = new Vue({
    el: '#app',
    render: function (h) {
        return h(App, {
            props: {
                paused: this.paused
            }
        });
    },
    data: {
        paused: false
    }
});

browser.runtime.onMessage.addListener((message) => {
    console.debug("[panel] Message received", message);
    if (message.action === "pause-changed") {
        vm.$data.paused = message.paused;
    }
});

window.onunload = function () {
    vm.$destroy();
    /*
    // Fixup "poisened" DownloadList instance...
    let downloadList = browser.extension.getBackgroundPage().getDownloadList();

    let groupFields = ["id", "title", "type", "selected"];
    let linkFields = [
        'id',
        'url',
        'state',
        'progress',
        'total',
        'xhr',
        'onProgress',
        'onState',
        'error',
        'type',
        'selected'
    ];


    for (let groupIdx in downloadList.downloads) {
        let group = downloadList.downloads[groupIdx];
        for (let field of groupFields) {
            let oldValue = group[field];
            delete(group[field]);
            group[field] = oldValue;
            console.log("Field", field, oldValue);
        }
        let links = group.links;
        delete(group.links);
        group.links = [];
        console.log(group);
        for (let link of links) {
            for (let field of linkFields) {
                let oldValue = link[field];
                delete(group[field]);
                link[field] = oldValue;
            }
            group.links.push(link);
        }
        downloadList.downloads[groupIdx] = group;
    };*/
};