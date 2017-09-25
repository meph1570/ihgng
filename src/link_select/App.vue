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
                console.log(this);
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
