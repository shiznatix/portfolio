const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const outputDir = '../dist/client';

module.exports = (env, options) => {
	const isProd = options.mode === 'production';

	return {
		// Enable sourcemaps for debugging webpack's output.
		devtool: isProd ? false : 'source-map',

		watchOptions: {
			aggregateTimeout: 300,
			poll: 1000,
		},

		resolve: {
			// Add '.ts' and '.tsx' as resolvable extensions.
			extensions: ['.ts', '.tsx', '.js'],
		},

		entry: {
			app: [path.resolve('src/index.js')],
		},

		output: {
			path: path.resolve(outputDir),
			filename: isProd ? '[fullhash].js' : '[name].js',
		},

		plugins: [
			new CleanWebpackPlugin(),
			new HtmlWebpackPlugin({
				title: 'VLC Remote',
				template: './src/index.tmpl.html',
				filename: 'index.tmpl.html',
			}),
			new CopyPlugin({
				patterns: [
					{
						from: './assets',
						to: './',
					},
				],
			}),
		],

		module: {
			rules: [
				{
					test: /\.ts(x?)$/,
					exclude: /node_modules/,
					include: path.resolve(__dirname, 'src'),
					use: [
						{
							loader: 'ts-loader',
							options: {
								compilerOptions: {
									noUnusedLocals: isProd,
									noUnusedParameters: isProd,
								},
							},
						},
					],
				},
				{
					test: /\.css$/i,                                                                                                                                                             
					use: ['style-loader', 'css-loader', 'sass-loader'],                                                                                                                          
				},
				// All output '.js' files will have any sourcemaps re-processed by 'source-map-loader'.
				{
					enforce: 'pre',
					test: /\.js$/,
					include: path.resolve(__dirname, 'src'),
					loader: 'source-map-loader',
				},
			],
		},
	};
};
