/**
 *
 * @source: settings/main.js
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

import Vue from 'vue'

import ElementUI from 'element-ui'
import 'element-ui/lib/theme-default/index.css'

import App from './App.vue'

Vue.use(ElementUI);

let vm;

async function getConfig() {
    let ihg = await browser.runtime.getBackgroundPage();

    let config = {
        hostfiles: [],
        hosters: ihg.ihgng.hosters.getHosterList()
    };

    for (let key of Object.keys(ihg.ihgng.config)) {
        if (key !== "hostfiles") {
            config[key] = ihg.ihgng.config[key];
        }
        else {
            for (let hostfile of ihg.ihgng.config.hostfiles) {
                config.hostfiles.push(Object.assign({}, hostfile));
            }
        }
    }

    let storage = await browser.storage.local.get();

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

    // TODO: find out why this need a superclone
    config = JSON.parse(JSON.stringify(config));

    return config;
}


getConfig().then(
    (config) => {
        vm = new Vue({
            el: '#app',
            render: function (h) {
                return h(App, {
                    props: {
                        config: this.config,
                        localHostFile: this.localHostFile,
                        testResult: this.testResult
                    },
                    on: {
                        "test-hoster": (params) => {
                            browser.runtime.sendMessage({
                                action: "test-hoster",
                                params: params
                            });
                        },
                        "save-hoster": (hoster) => {
                            browser.runtime.sendMessage({
                                action: "save-hoster",
                                hoster: hoster
                            });
                        },
                        "delete-hoster": (hosterId) => {
                            browser.runtime.sendMessage({
                                action: "delete-hoster",
                                hosterId: hosterId
                            })
                        },
                        "refresh-hosters": () => {
                            browser.runtime.sendMessage({
                                action: "refresh-hosters",
                                feedback: true
                            });
                        },
                        "cancel": () => {
                            browser.runtime.sendMessage({
                                action: "close"
                            });
                        },
                        "save": (params) => {
                            browser.runtime.sendMessage({
                                action: "save-config",
                                config: params.config
                            })
                        },
                        "get-local-hostfile": () => {
                            browser.runtime.sendMessage({
                                action: "get-local-hostfile"
                            });
                        }
                    },
                    ref: "settings"
                });
            },
            data: {
                config: config,
                localHostFile: "",
                testResult: {}
            }
        });
    },
    (e) => console.error("Can't fetch config: ", e)
);


browser.runtime.onMessage.addListener((message) => {
    console.debug("[settings] Message received", message);

    if (message.action === "config") {

    }
    else if (message.action === "test-hoster") {
        message.result.available = true;
        vm.$data.testResult = message.result;
    }
    else if (message.action === "refresh-hosters") {
        vm.$data.config.hosters = message.hosters;
        if (message.cause) {
            let settings = vm.$refs.settings;
            if (settings.handleRefreshCause) {
                settings.handleRefreshCause({
                    cause: message.cause,
                    causeExtra: message.causeExtra ? message.causeExtra : null
                });
            }
        }
        if (message.feedback) {
            vm.$notify({
                title: "Success",
                message: "Hostfiles reloaded",
                type: "success"
            });
        }
    }
    else if (message.action === "local-hostfile") {
        vm.$data.localHostFile = message.content;
    }
});