import Vue from 'vue'

import ElementUI from 'element-ui'
import 'element-ui/lib/theme-default/index.css'

import App from './App.vue'
import LinkList from "./LinkList.vue";

Vue.use(ElementUI);


Vue.component("link-list", LinkList);


browser.runtime.onMessage.addListener((message) => {
    console.log("Message for link_select:", message.links);

    new Vue({
        el: '#app',
        render: function (h) {
            console.log("render", this.links);
            return h(App, {props: {links: this.links}});
        },
        data: {
            links: message.links
        },
        propsData: {
            links: message.links
        }
    });
});