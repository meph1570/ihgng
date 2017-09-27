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
        <el-row id="tree-holder">
            <el-col :span="24">
                <div @contextmenu.prevent="contextMenuRequested($event)">
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
                </div>
            </el-col>
        </el-row>

        <el-row id="controls">
            <el-col :span="24">
                <el-button @click="unpauseDownloads" v-if="paused">
                    <img class="icon" src="/icons/play.svg" alt="" />
                    Start
                </el-button>
                <el-button @click="pauseDownloads" v-if="!paused">
                    <img class="icon" src="/icons/pause.svg" alt="" />
                    Pause
                </el-button>
                <el-button @click="removeAllDownloads" v-if="!paused">
                    <img class="icon" src="/icons/bin.svg" alt="" />
                    Clear list
                </el-button>
            </el-col>
        </el-row>

        <context-menu id="context-menu" ref="ctxMenu">
            <li class="ctx-item" @click="resumeDownloads">
                <img src="/icons/loop.svg" /> Resume
            </li>
            <li class="ctx-item" @click="cancelDownloads">
                <img src="/icons/cross.svg" /> Cancel
            </li>
            <li class="ctx-item" @click="removeDownloads">
                <img src="/icons/bin.svg" /> Remove
            </li>
        </context-menu>
    </div>
</template>

<script type="text/babel">
    import contextMenu from "vue-context-menu";

    import { humanFileSize, states } from "../lib/utils.js";
    import {SelectionModel} from "../lib/utils";

    let downloadList = browser.extension.getBackgroundPage().getDownloadList();
    downloadList.refresh();

    let downloads = downloadList.downloads;

    export default {
        name: 'app',

        props: {
            paused: { type: Boolean }
        },

        components: {
            contextMenu
        },

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
            console.debug("[panel] Mounted", this);
        },

        event: null,

        methods: {
            append(store, data) {
                store.append({id: id++, label: 'testtest', children: []}, data);
            },

            remove(store, data) {
                store.remove(data);
            },

            pauseDownloads() {
                downloadList.pause();
            },

            unpauseDownloads() {
                downloadList.unpause();
            },

            removeAllDownloads() {
                if (confirm("Are you sure?")) {
                    downloadList.clear();
                }
            },

            groupSelection() {
                let selection = this.selectionModel.getSelection();
                let groups = {};
                for (let [groupIdx, linkIdx] of selection.sort((a,b) => a[0] > b[0])) {
                    if (!(groupIdx in groups)) {
                        groups[groupIdx] = [];
                    }
                    if (groups[groupIdx] !== null) {
                        if (linkIdx !== -1) {
                            groups[groupIdx].push(linkIdx);
                        }
                        else {
                            groups[groupIdx] = null;
                        }
                    }
                }
                return groups;
            },

            removeDownloads() {
                let groups = this.groupSelection();

                this.clearSelection();
                this.selectionModel.clear();

                downloadList.removeIndexes(groups);
            },

            resumeDownloads() {
                let groups = this.groupSelection();
                downloadList.resumeIndexes(groups);
            },

            cancelDownloads() {
                let groups = this.groupSelection();
                downloadList.cancelIndexes(groups);
            },

            contextMenuRequested(event) {
                let e = event.target;
                let $row = e.closest(".tree-node");

                let groupIdx, linkIdx;

                if ($row.classList.contains("group")) {
                    groupIdx = downloadList.groupIdToIndex[$row.dataset.id];
                    linkIdx = -1;
                }
                else if ($row.classList.contains("link")) {
                    [groupIdx, linkIdx] = downloadList.linkIdToIndex[$row.dataset.id];
                }
                else {
                    console.error("Unexpected element found");
                    return;
                }

                if (!this.selectionModel.isSelected(groupIdx, linkIdx)) {
                    this.clearSelection();
                    this.selectionModel.selectSingle(groupIdx, linkIdx);
                    this.highlightSelection();
                }
                this.$refs.ctxMenu.open(event);
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
                    <div class={{ "tree-node": true, "link": true }}
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
                            { link.state }
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
                    <div class={{ "tree-node": true, "group": true }}
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
    #controls .icon {
        vertical-align: middle;
    }

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

    .file-size {
        margin-left: 4px;
    }

    .node-extra {
        width: 6em;
        text-align: center;
    }

    #context-menu img {
        vertical-align: text-top;
        margin-right: 6px;
        opacity: 0.5;
    }

    #context-menu .ctx-item:hover img {
        opacity: 1;
    }

    #controls {
        margin-top: 1em;
    }

    #controls button {
        margin-left: 0;
    }
</style>
