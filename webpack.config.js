var path = require('path');
var webpack = require('webpack');

module.exports = {
    entry: {
        panel: "./src/panel/main.js",
        link_select: "./src/link_select/main.js",
        settings: "./src/settings/main.js",
        background: "./src/background/main.js",
        popup: "./src/popup/popup.js"
    },
    output: {
        path: path.resolve(__dirname, './addon/'),
        publicPath: '/',
        filename: '[name]/index.js'
    },
    module: {
        rules: [
            {
                test: /\.vue$/,
                loader: 'vue-loader',
                options: {
                    loaders: {}
                    // other vue-loader options go here
                }
            },
            {
                test: /\.js$/,
                loader: 'babel-loader',
                exclude: /node_modules/
            },
            {
                test: /\.(png|jpg|gif|svg)$/,
                loader: 'file-loader',
                options: {
                    name: '[name].[ext]?[hash]'
                }
            },
            {
                test: /\.css$/,
                loader: 'style-loader!css-loader'
            },
            {
                test: /\.(eot|svg|ttf|woff|woff2)(\?\S*)?$/,
                loader: 'file-loader?name=./assets/[hash].[ext]'
            }
        ],
        loaders: [
            {
                test: /\.css$/,
                loader: 'style-loader!css-loader'
            }
        ]
    },
    resolve: {
        alias: {
            'vue$': 'vue/dist/vue.esm.js'
        }
    },
    devServer: {
        historyApiFallback: true,
        noInfo: true
    },
    performance: {
        hints: false
    },
    plugins: [

    ],
    devtool: '#eval-source-map'
};

if (process.env.NODE_ENV === 'production') {
    module.exports.devtool = '#source-map'
    // http://vue-loader.vuejs.org/en/workflow/production.html
    module.exports.plugins = (module.exports.plugins || []).concat([
        new webpack.DefinePlugin({
            'process.env': {
                NODE_ENV: '"production"'
            },
            HOSTFILE_URL: JSON.stringify(require("./globals.json").PRODUCTION.HOSTFILE_URL)
        }),
        new webpack.optimize.UglifyJsPlugin({
            sourceMap: true,
            compress: {
                warnings: false
            }
        }),
        new webpack.LoaderOptionsPlugin({
            minimize: true
        })
    ])
}
else if (process.env.NODE_ENV === "development") {
    module.exports.plugins = (module.exports.plugins || []).concat([
        new webpack.DefinePlugin({
            HOSTFILE_URL: JSON.stringify(require("./globals.json").DEV.HOSTFILE_URL)
        })
    ]);
}