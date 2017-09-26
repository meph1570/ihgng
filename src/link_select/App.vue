<!--

 Copyright (C) 2017  Mephisto


 This program is free software: you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.

 You should have received a copy of the GNU General Public License
 along with this program.  If not, see <http://www.gnu.org/licenses/>.

-->

<template>
    <div id="app">
        <h1>Select links to download</h1>
        <el-row>
            <el-col :span="24">
                <link-list ref="linkList" :hideThumbs=hideThumbs :links=links></link-list>
            </el-col>
        </el-row>
        <el-row id="buttons" justify="end">
            <el-col :span="6" :offset="18">
                <el-button @click="close()">Cancel</el-button>
                <el-button type="primary" @click="queueDownloads()">Download selected</el-button>
            </el-col>
        </el-row>
    </div>
</template>

<script type="text/babel">
    export default {
        name: "app",
        props: {
            "links": {type: Array},
            "hideThumbs": {type: Boolean}
        },

        data() {
            return {
                selectedLinks: []
            };
        },

        methods: {
            close() {
                browser.runtime.sendMessage({
                    action: "close"
                });
            },

            queueDownloads() {
                let selectedLinks = this.$refs.linkList.selectedLinks;
                let links = [];
                // de-vue-ify to handle of to background script

                for (let link of selectedLinks) {
                    links.push({
                        url: link.url
                    })
                }

                browser.runtime.sendMessage({
                    action: "links",
                    links: links,
                    start: true,
                    close: true
                });
            }
        }
    }
</script>

<style>
#buttons {
    margin-top: 20px;
    text-align: right;
}
</style>
