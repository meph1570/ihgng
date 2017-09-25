import Vue from 'vue'

import ElementUI from 'element-ui'
import 'element-ui/lib/theme-default/index.css'

import App from './App.vue'
import LinkList from "./LinkList.vue";

Vue.use(ElementUI);


Vue.component("link-list", LinkList);


browser.runtime.onMessage.addListener((message) => {
    console.log("Message for link_select:", message.links);

    if (message.action === "set-links") {
        new Vue({
            el: '#app',
            render: function (h) {
                console.log("render", this.links);
                return h(App, {props: {
                    links: this.links,
                    hideThumbs: this.hideThumbs
                }});
            },
            data: {
                links: message.links,
                hideThumbs: message.hideThumbs
            },
            propsData: {
                links: message.links
            }
        });
    }
});