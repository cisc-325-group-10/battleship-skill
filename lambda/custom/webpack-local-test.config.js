const nodeExternals = require('webpack-node-externals');
module.exports = {
    entry: './src/dev.init.ts',
    mode: 'development',
    externals: [nodeExternals()],
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: {
                    loader: 'babel-loader',
                },
            },
        ],
    },
    devtool: "source-map",
    stats: 'minimal',
    target: 'node',
};