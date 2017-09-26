/**
 *
 * @source: link_select/main.js
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
import LinkList from "./LinkList.vue";

Vue.use(ElementUI);


Vue.component("link-list", LinkList);


browser.runtime.onMessage.addListener((message) => {
    console.debug("[link-select] Message received", message.links);

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