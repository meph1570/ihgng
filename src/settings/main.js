import Vue from 'vue'

import ElementUI from 'element-ui'
import 'element-ui/lib/theme-default/index.css'

import App from './App.vue'

Vue.use(ElementUI);

let vm;

browser.runtime.onMessage.addListener((message) => {
    console.log("Message for 'settings':", message);

    if (message.action === "config") {
        vm = new Vue({
            el: '#app',
            render: function (h) {
                return h(App, {
                    props: {config: this.config, testResult: this.testResult},
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
                        }
                    },
                    ref: "settings"
                });
            },
            data: {
                config: message.config,
                testResult: {}
            }
        });
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
});