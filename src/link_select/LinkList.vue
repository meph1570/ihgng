<template>
    <div class="table-holder" @contextmenu.prevent="$refs.ctxMenu.open">
        <el-table
                ref="multipleTable"
                :data=links
                border
                style="width: 100%"
                class="link-table"
                @selection-change="handleSelectionChange"
                @row-click="handleRowClick"
                @row-contextmenu="handleContextMenu">
            <el-table-column
                    type="selection"
                    width="55">
            </el-table-column>
            <el-table-column
                    label="Thumb"
                    class-name="thumbnail-column"
                    width="120">
                <template scope="scope">
                    <!--<img v-if="scope.row.thumb" :src=scope.row.thumb/>-->
                    <el-popover v-if="scope.row.thumb && thumbsEnabled" trigger="hover" placement="top">
                        <img :src=scope.row.thumb />
                        <div slot="reference" class="thumb-wrapper">
                            <img :src=scope.row.thumb />
                        </div>
                    </el-popover>
                    <span v-if="!thumbsEnabled">
                        [hidden]
                    </span>
                </template>
            </el-table-column>
            <el-table-column
                    label="Url"
                    show-overflow-tooltip>
                <template scope="scope">
                    {{ scope.row.url }}
                    <a :href=scope.row.url target="_blank">
                        <i class=" el-icon-document"></i>
                    </a>
                </template>
            </el-table-column>
        </el-table>

        <context-menu id="context-menu" ref="ctxMenu">
            <li class="ctx-item" @click="handleCtxMenuDisable">Disable</li>
            <li class="ctx-item" @click="handleCtxMenuEnable">Enable</li>
            <li class="ctx-item" @click="handleCtxMenuToggle">Toggle</li>
            <li class="ctx-divider"></li>
            <li class="ctx-item" @click="handleCtxMenuToggleThumbs">Toggle thumbnails</li>
        </context-menu>

    </div>
</template>

<script type="text/babel">
    import contextMenu from "vue-context-menu"

    import { SelectionModel } from "../lib/utils";

    export default {
        name: "link-list",
        data() {
            return {
                selectedLinks: [],
                selectionModel: new SelectionModel(() => 1, (groupIdx) => this.links.length),
                thumbsEnabled: true
            };
        },

        mounted() {
            console.log("mounted this", this);

            this.$el.querySelector("div.el-table").classList.remove("el-table--enable-row-hover");

            let idx = 0;
            for (let link of this.links) {
                link.index = idx++;
                this.$refs.multipleTable.toggleRowSelection(link);
            }

            document.addEventListener(
                "keydown",
                (event) => {
                    if (event.key === "a" && event.ctrlKey) {
                        this.clearSelection();
                        this.selectionModel.selectAll(/*includeGroups = */false);
                        this.highlightSelection();

                        event.preventDefault();
                        return true;
                    }
                }
            );
        },

        props: {
            "links": {type: Array}
        },

        components: { contextMenu },

        methods: {
            handleSelectionChange(val) {
                this.selectedLinks = val;
            },

            getRow(i) {
                let index = parseInt(i) + 1;
                return this.$refs.multipleTable.$el.querySelector(`tbody tr:nth-child(${index})`);
            },

            clearSelection() {
                this.selectionModel.getSelection().forEach((pair) => {
                    this.getRow(pair[1]).style = "";
                });
            },

            highlightSelection() {
                this.selectionModel.getSelection().forEach((pair) => {
                    this.getRow(pair[1]).style = "background-color: lightsteelblue";
                });
            },

            handleRowClick(row, event, column) {
                this.clearSelection();

                let index = row.index;

                if (!event.shiftKey && !event.ctrlKey) {
                    this.selectionModel.selectSingle(0, index);
                }

                if (event.ctrlKey) {
                    this.selectionModel.selectAppend(0, index);
                }

                if (event.shiftKey) {
                    this.selectionModel.selectRange(0, index);
                }

                this.highlightSelection();
            },

            handleContextMenu(row, event) {
                console.log(row, event, this);
                //this.$refs.ctxMenu.open();
                event.preventDefault();
            },

            toggleSelection(toggle) {
                for (let rowIdx in this.selectionModel.selection) {
                    this.$refs.multipleTable.toggleRowSelection(this.links[rowIdx], toggle);
                }
            },

            handleCtxMenuDisable() {
                this.toggleSelection(false);
            },

            handleCtxMenuEnable() {
                this.toggleSelection(true);
            },

            handleCtxMenuToggle() {
                this.toggleSelection();
            },

            handleCtxMenuToggleThumbs() {
                this.thumbsEnabled = !this.thumbsEnabled;
                /*this.$refs.multipleTable.$el.querySelectorAll(".thumbnail-column img").forEach((e) => {
                    e.style.display = e.style.display ? "" : "none";
                });*/
            }
        }
    }
</script>

<style>
    .cell img {
        max-width: 100%;
        padding: 5px;
        vertical-align: center;
    }

    .link-table {
        -moz-user-select: none;
    }

</style>
