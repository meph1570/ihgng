<template>
    <div id="app">
        <h1>Settings</h1>
        <!--<el-form ref="form" :model="config" label-width="250px">
            <el-form-item label="Hide thumbnails">
                <el-switch on-text="" off-text="" v-model="config.hideThumbs"></el-switch>
            </el-form-item>
            <el-form-item label="Enable debug mode">
                <el-switch on-text="" off-text="" v-model="config.debug"></el-switch>
            </el-form-item>
            <el-form-item label="Max concurrent downloads">
                <el-input-number v-model="config.threads" :min="1" :max="20"></el-input-number>
            </el-form-item>

            <el-form-item label="Last hostfile sync">

            </el-form-item>
        </el-form>-->
        <div id="options-box">

            <el-row type="flex" :gutter="20">
                <el-col :span="3">Paralell downloads</el-col>
                <el-col :span="21">
                    <el-input-number v-model="config.threads" :min="1" :max="20"></el-input-number>
                </el-col>
            </el-row>

            <el-row type="flex" :gutter="20">
                <el-col :span="3">Hide thumbnails</el-col>
                <el-col :span="21">
                    <el-switch on-text="" off-text="" v-model="config.hideThumbs"></el-switch>
                </el-col>
            </el-row>

            <div class="separator"></div>

            <el-row type="flex" :gutter="20">
                <el-col :span="3" class="align-baseline">Hostfiles</el-col>
                <el-col :span="21">
                    <el-table
                            ref="hostFileSources"
                            :data=config.hostfiles
                            border
                            style="width: 100%"
                            class="hostfile-table"
                            empty-text="No sources defined"
                            @selection-change="handleSelectionChange">
                        <el-table-column
                                label="Enabled"
                                type="selection"
                                width="55">
                        </el-table-column>
                        <el-table-column
                                label="Source"
                                property="url">
                        </el-table-column>
                        <el-table-column
                                label="Last update"
                                property="lastSync"
                                :formatter="formatDate">

                        </el-table-column>
                        <el-table-column width="300px" class-name="hostfile-actions">
                            <template scope="scope">
                                <el-button
                                        size="small"
                                        :disabled="scope.$index == 0"
                                        @click="moveSourceUp(scope.$index, scope.row)">
                                    <i class="el-icon-arrow-up"></i>
                                </el-button>
                                <el-button
                                        size="small"
                                        :disabled="scope.$index == config.hostfiles.length - 1"
                                        @click="moveSourceDown(scope.$index, scope.row)">
                                    <i class="el-icon-arrow-down"></i>
                                </el-button>
                                <el-button
                                        size="small"
                                        type="info"
                                        @click="editSource(scope.$index, scope.row)">
                                    <i class="el-icon-edit"></i>
                                </el-button>
                                <el-button
                                        size="small"
                                        type="danger"
                                        @click="deleteSource(scope.$index, scope.row)">
                                    <i class="el-icon-delete"></i>
                                </el-button>
                            </template>
                        </el-table-column>
                    </el-table>
                </el-col>
            </el-row>
            <el-row type="flex" :gutter="20">
                <el-col :offset="3" :span="21" class="buttons">
                    <el-button @click="addSourceRow">Add source</el-button>
                    <el-button @click="refreshHosters">Refresh</el-button>
                </el-col>
            </el-row>

            <template v-if="config.debug">

                <div class="separator"></div>

                <el-row type="flex" :gutter="20">
                    <el-col :span="3">Edit hosts</el-col>
                    <el-col :span="21">
                        <el-select placeholder="Select" @change="showHoster" v-model="selectedHoster">
                            <el-option value="<new>">New</el-option>
                            <el-option value="" :disabled="true"></el-option>
                            <el-option
                                    v-for="item in config.hosters"
                                    :key="item.id"
                                    :label="item.id"
                                    :value="item.id">
                            </el-option>
                        </el-select>
                    </el-col>
                </el-row>

                <el-row type="flex" :gutter="20">
                    <el-col :span="3">Source</el-col>
                    <el-col :span="21">
                        {{ currentHoster.source }}
                    </el-col>
                </el-row>

                <el-row type="flex" :gutter="20">
                    <el-col :span="3">Id</el-col>
                    <el-col :span="21">
                        <el-input v-model="currentHoster.id"></el-input>
                    </el-col>
                </el-row>

                <el-row type="flex" :gutter="20">
                    <el-col :span="3">Url pattern</el-col>
                    <el-col :span="21">
                        <el-input v-model="currentHoster.urlpattern"></el-input>
                    </el-col>
                </el-row>

                <el-row type="flex" :gutter="20">
                    <el-col :span="3" class="align-baseline">Search pattern</el-col>
                    <el-col :span="21">
                        <el-input type="textarea" v-model="currentHoster.searchpattern"></el-input>
                    </el-col>
                </el-row>

                <el-row type="flex" :gutter="20">
                    <el-col :span="3">Test Url</el-col>
                    <el-col :span="21">
                        <el-input v-model="testUrl"></el-input>
                    </el-col>
                </el-row>

                <template v-if="testResult.available">
                    <template v-if="!testResult.error">
                        <el-row type="flex" :gutter="20">
                            <el-col :span="3">Pattern matches</el-col>
                            <el-col :span="21">
                                {{ testResult.patternMatches }}
                            </el-col>
                        </el-row>
                        <el-row type="flex" :gutter="20">
                            <el-col :span="3">Picture Url</el-col>
                            <el-col :span="21">
                                <a :href="testResult.parseResult.imgUrl">{{ testResult.parseResult.imgUrl }}</a>
                            </el-col>
                        </el-row>
                        <el-row type="flex" :gutter="20">
                            <el-col :span="3">Filename</el-col>
                            <el-col :span="21">
                                {{ testResult.parseResult.fileName }}
                            </el-col>
                        </el-row>
                    </template>
                    <template v-else>
                        <el-row type="flex" :gutter="20">
                            <el-col :span="3">Result</el-col>
                            <el-col :span="21">
                                {{ testResult.error }}
                            </el-col>
                        </el-row>
                        <el-row v-if="testResult.context" type="flex" :gutter="20">
                            <el-col :span="3">Context</el-col>
                            <el-col class="error" :span="21">
                                <pre>{{ JSON.stringify(testResult.context, null, 4) }}</pre>
                            </el-col>
                        </el-row>
                    </template>
                    <template v-if="testResult.log">
                        <el-row type="flex" :gutter="20">
                            <el-col :span="3">Result</el-col>
                            <el-col :span="21">
                                <pre>{{ testResult.log }}</pre>
                            </el-col>
                        </el-row>
                    </template>
                </template>

                <el-row type="flex" :gutter="20">
                    <el-col :offset="3" :span="21" class="buttons">
                        <el-button @click="saveHoster">Save</el-button>
                        <el-button @click="testHoster">Test</el-button>
                        <el-button type="danger" @click="deleteCurrentHoster">Delete</el-button>
                    </el-col>
                </el-row>
            </template>

            <div class="separator"></div>

            <el-row type="flex" :gutter="20">
                <el-col :span="3" class="align-baseline">Debug mode</el-col>
                <el-col :span="21">
                    <el-switch on-text="" off-text="" v-model="config.debug"></el-switch>
                    <p>Don't touch this unless you know what you're doing</p>
                </el-col>
            </el-row>

            <div class="separator"></div>

        </div>

        <div id="button-box" style="text-align: center">
            <el-button @click="saveSettings" type="primary">Save</el-button>
            <el-button @click="cancel">Cancel</el-button>
        </div>

    </div>
</template>

<script type="text/babel">
    export default {
        name: "app",
        props: {
            "config": {type: Object},
            "testResult": {type: Object}
        },

        watch: {
            "config.hostfiles": function (value) {
                this.applySelection();
            },
            "config.debug": function (debug) {
                if (debug) {
                    this.refreshHosters();
                }
            }
        },

        mounted() {
            console.log("Settings mounted", this);
            this.applySelection();
        },

        data() {
            return {
                "selectedHoster": "",
                "currentHoster": {},
                "testUrl": ""
            };
        },

        methods: {
            formatDate(row, column, ts) {
                let date = new Date(ts);

                if (Number.isNaN(date.valueOf())) {
                    return "never";
                }

                return date.toString();
            },

            applySelection() {
                for (let source of this.config.hostfiles) {
                    this.$refs.hostFileSources.toggleRowSelection(source, source.enabled);
                }
            },

            editSource(index) {
                let url = prompt("Enter URL", this.config.hostfiles[index].url);
                if (url !== null) {
                    this.config.hostfiles[index].url = url;
                }
            },

            deleteSource(index) {
                this.$delete(this.config.hostfiles, index);
            },

            addSourceRow() {
                let url = prompt("Enter URL");
                if (url !== null) {
                    this.config.hostfiles.push({
                        url: url,
                        enabled: true
                    });
                }
            },

            refreshHosters() {
                this.$notify.info({
                    title: "Info",
                    message: "Reloading hostfiles..."
                });
                this.$emit("refresh-hosters", true);
            },

            handleSelectionChange(val) {
                for (let source of this.config.hostfiles) {
                    source.enabled = false;
                }
                for (let source of val) {
                    source.enabled = true;
                }
            },

            moveSourceUp(index, row) {

                this.config.hostfiles.splice(
                    index - 1, 2,
                    this.config.hostfiles[index], this.config.hostfiles[index - 1]
                );
            },

            moveSourceDown(index, row) {
                this.config.hostfiles.splice(
                    index, 2,
                    this.config.hostfiles[index + 1], this.config.hostfiles[index]
                );
            },

            getHoster(hosterId) {
                let i = 0;
                for (let hoster of this.config.hosters) {
                    if (hoster.id === hosterId) {
                        return {index: i, hoster: hoster};
                    }
                    i++;
                }
                return null;
            },

            showHoster(hosterId) {
                if (hosterId === "<new>") {
                    this.currentHoster = {};
                }
                else {
                    let hoster = this.getHoster(hosterId).hoster;
                    this.currentHoster = {};
                    Object.assign(this.currentHoster, hoster);
                }
            },

            deleteCurrentHoster() {
                if (this.currentHoster.source === "storage://") {
                    this.$emit("delete-hoster", this.currentHoster.id);
                }
                else {
                    alert("Only hosts from local hostfile can be deleted");
                }
            },

            testHoster() {
                let params = Object.assign({}, this.currentHoster);
                params["url"] = this.testUrl;

                this.$emit("test-hoster", params);
            },

            saveHoster() {
                let hoster = Object.assign({}, this.currentHoster);
                this.currentHoster.source = "storage://"
                this.$emit("save-hoster", hoster);
            },

            handleRefreshCause(info) {
                if (info.cause === "delete-hoster") {
                    this.selectedHoster = "<new>";
                }
                else if (info.cause === "save-hoster") {
                    this.selectedHoster = info.causeExtra;
                }
            },

            saveSettings() {
                let config = Object.assign({}, this.config);
                this.$emit("save", {
                    config: config
                });
            },

            cancel() {
                this.$emit("cancel");
            }
        }
    }
</script>

<style>
    #app {
        display: flex;
        flex-direction: column;
        height: calc(100vh - 16px); /* sigh ¯\_(ツ)_/¯  */
        overflow: hidden;
    }

    #options-box {
        flex-grow: 1;
        /*max-height: 80vh;*/
        overflow-y: scroll;
        overflow-x: hidden;
    }

    #button-box {
    }

    .el-row {
        margin-top: 20px;
        padding-right: 20px;
        align-items: center;
    }

    .el-col.el-col-3 {
        text-align: right;

    }

    .align-baseline {
        align-self: baseline;
    }

    .hostfile-actions {
        text-align: center;
    }

    .separator {
        height: 2px;
        background-color: #eee;
        margin: 15px auto;
        width: 98%;
    }

    .el-col.buttons {
    }
</style>
