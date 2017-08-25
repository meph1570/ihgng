<template>
    <div id="app">
        <el-row id="tree-holder">
            <el-col :span="24">
                <el-tree
                        ref="tree"
                        :data="data2"
                        :props="defaultProps"
                        empty-text="No downloads"
                        node-key="id"
                        default-expand-all
                        :expand-on-click-node="false"
                        :render-content="renderContent"
                        v-on:node-click="nodeClicked"
                >
                </el-tree>
            </el-col>
        </el-row>
    </div>
</template>

<script type="text/babel">
    import { humanFileSize, states } from "../lib/utils.js";
    import {SelectionModel} from "../lib/utils";

    let downloadList = browser.extension.getBackgroundPage().getDownloadList();
    downloadList.refresh();

    let downloads = downloadList.downloads;

    export default {
        name: 'app',
        data() {
            return {
                data2: downloads,
                selectionModel: new SelectionModel(
                    () => downloadList.downloads.length,
                    (groupIdx) => downloadList.downloads[groupIdx].links.length
                ),
                lastSelection: null,
                selection: {},
                defaultProps: {
                    children: "links",
                    label: function (node, data) {
                        if (node.type === "group") {
                            return node.title;
                        }
                        else {
                            return node.url;
                        }

                    }
                }
            };
        },

        mounted() {

        },

        event: null,

        methods: {
            append(store, data) {
                store.append({id: id++, label: 'testtest', children: []}, data);
            },

            remove(store, data) {
                store.remove(data);
            },

            getIdFromPair(pair) {
                let [groupIdx, linkIdx] = pair;
                if (linkIdx !== -1) {
                    return downloadList.downloads[groupIdx].links[linkIdx].id;

                }
                else {
                    return downloadList.downloads[groupIdx].id;
                }
            },

            highlightSelection() {
                this.selectionClass("add");
            },

            clearSelection() {
                this.selectionClass("remove");
            },

            selectionClass(action) {
                let $root = this.$refs.tree.$el;
                this.selectionModel.getSelection().forEach((pair) => {
                    let id = this.getIdFromPair(pair);
                    let $e = $root.querySelector(`[data-id='${id}']`).parentElement;

                    $e.classList[action]("selected");
                });
            },

            nodeClicked(nodeData, node, treeNode) {
                let event = this.event;

                this.clearSelection();

                let groupIdx, linkIdx;
                if (nodeData.type === "group") {
                    groupIdx = downloadList.groupIdToIndex[nodeData.id];
                    linkIdx = -1;
                }
                else {
                    [groupIdx, linkIdx] = downloadList.linkIdToIndex[nodeData.id];
                }

                if (!event.shiftKey && !event.ctrlKey) {
                    this.selectionModel.selectSingle(groupIdx, linkIdx);
                }

                if (event.ctrlKey) {
                    this.selectionModel.selectAppend(groupIdx, linkIdx);
                }

                if (event.shiftKey) {
                    this.selectionModel.selectRange(
                        groupIdx,
                        linkIdx
                    );
                }

                this.highlightSelection();

                this.event = null;
            },

            clickHandler(event) {
                this.event = event;
            },

            renderLink(h, {node, data: link, store}) {
                let percent = 0;
                let status = null;
                if (link.type === "link") {
                    if (link.total) {
                        percent = Math.round((link.progress / link.total) * 100);
                    }

                    let statusMap = {};
                    statusMap[states.FINISHED] = "success";
                    statusMap[states.FAILED] = "exception";

                    if (link.state in statusMap) {
                        status = statusMap[link.state];
                    }
                }

                return (
                    <div class={{ "tree-node": true}}
                         onClick={this.clickHandler}
                         data-id={link.id}>
                        <div class="node-label-container">
                            <span>{ node.label }</span>
                        </div>
                        <div class="node-progress">
                            <el-progress percentage={ percent } status={ status }></el-progress>
                        </div>
                        <div class="node-size">
                            <span class="transferred">{humanFileSize(link.progress)}</span>
                            <span class="separator">/</span>
                            <span class="total">{humanFileSize(link.total)}</span>
                        </div>
                        <div class="node-extra">
                        </div>
                    </div>
                );
            },

            renderGroup(h, {node, data: group, store}) {
                let total = group.links.length;
                let completed = 0;
                for (let link of group.links) {
                    if (link.status === states.FINISHED) {
                        completed++;
                    }
                }
                let sumFileSizes = (links) => {
                    let size = 0;
                    for (let link of links) {
                        size += link.progress
                    }
                    return size;
                };

                let sumCompleted = (links) => {
                    let completed = 0;
                    for (let link of links) {
                        if (link.state === states.FINISHED) {
                            completed++;
                        }
                    }
                    return completed;
                };

                return (
                    <div class={{ "tree-node": true}}
                         onClick={this.clickHandler}
                         data-id={group.id}>
                        <div class="node-label-container">
                            <span>{ node.label }</span>
                        </div>
                        <div class="node-progress"></div>
                        <div class="node-size">
                            <span class="transferred">{ sumCompleted(group.links) }</span>
                            <span class="separator">/</span>
                            <span class="total">{ total }</span>
                            <span class="file-size">
                                ({ humanFileSize(sumFileSizes(group.links)) })
                            </span>
                        </div>
                        <div class="node-extra">
                        </div>
                    </div>
                );
            },

            renderContent(h, {node, data, store}) {
                if (data.type === "link") {
                    return this.renderLink(h, {node, data, store});
                }
                else if (data.type === "group") {
                    return this.renderGroup(h, {node, data, store});
                }
                else {
                    console.error("Invalid node type");
                }
            }
        }
    }
</script>

<style>
    #tree-holder {
         -moz-user-select: none;
    }

    .tree-node {
        display: inline-flex;
        justify-content: space-between;
        align-items: center;
        flex-direction: row;
        width: calc(100% - 55px);
    }

    .el-tree-node__content.selected {
        background-color: lightsteelblue;
    }

    .tree-node.selected .node-label-container {
        /*font-weight: bold;*/
    }

    .tree-node-group .node-progress, .tree-node-group .node-size {
        display: none;
    }

    .node-label-container {
        overflow: hidden;
        text-overflow: ellipsis;
        flex-grow: 1;
        max-width: 45vw;
    }

    .node-progress {
        width: 35vw;
        flex-grow: 0;
    }

    .node-size {
        margin: 0 8px 0 0;
        width: 12em;
        text-align: center;
    }

    /*
    #app {
        font-family: 'Avenir', Helvetica, Arial, sans-serif;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        text-align: center;
        color: #2c3e50;
        margin-top: 60px;
    }

    h1, h2 {
        font-weight: normal;
    }

    ul {
        list-style-type: none;
        padding: 0;
    }

    li {
        display: inline-block;
        margin: 0 10px;
    }

    a {
        color: #42b983;
    }*/
</style>
