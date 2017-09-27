/**
 *
 * @source: panel/main.js
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
