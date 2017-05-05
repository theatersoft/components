'use strict'
require('shelljs/make')

const
    fs = require('fs'),
    {rollup} = require('rollup'),
    alias = require('rollup-plugin-alias'),
    babel = require('rollup-plugin-babel'),
    commonjs = require('rollup-plugin-commonjs'),
    nodeResolve = require('rollup-plugin-node-resolve'),
    replace = require('rollup-plugin-replace'),
    sourcemaps = require('rollup-plugin-sourcemaps'),
    postcss = require('rollup-plugin-postcss'),
    stylus = require('stylus'),
    postcssModules = require('postcss-modules'),
    cssExports = {},
    postcssImport = require("postcss-import"),
    string = require('rollup-plugin-string'),
    options = {
        entry: 'src/index.js',
        plugins: [
            postcss({
                preprocessor: (content, id) => new Promise((resolve, reject) => {
                    console.log('preprocess', id)
                    const renderer = stylus(content, {
                        filename: id,
                        sourcemap: {inline: true},
                        compress: false,
                        paths: ['node_modules']
                    })
                    renderer.render((err, code) =>
                        err ? reject(err) : resolve({code, map: renderer.sourcemap})
                    )
                }),
                extensions: ['.css', '.styl'],
                //sourceMap: true, // true, "inline" or false
                //extract: 'dist/theatersoft.css',
                plugins: [
                    postcssModules({
                        getJSON(id, exportTokens) {cssExports[id] = exportTokens},
                        globalModulePaths: ['components.css']
                    }),
                    postcssImport()
                ],
                getExport: id => cssExports[id]
            }),
            nodeResolve({
                jsnext: true,
                module: true,
                //browser: true, // https://github.com/rollup/rollup-plugin-node-resolve/issues/55
                main: true,
            }),
            replace({
                'process.env.NODE_ENV': JSON.stringify('production')
            }),
            string({include: '/**/*.svg'}),
            //sourcemaps(),
            babel({
                exclude: ['node_modules/**', '/**/*.svg'],
                plugins: [
                    [require("babel-plugin-transform-object-rest-spread"), {useBuiltIns: true}],
                    require("babel-plugin-transform-class-properties"),
                    [require("babel-plugin-transform-react-jsx"), {pragma: 'h'}],
                    //require("babel-plugin-transform-decorators-legacy"),
                    // babel-plugin-transform-decorators-legacy provided an invalid property of "default"
                    require("babel-plugin-external-helpers"),
                ]
            })
        ],
        dest: 'public/index.js',
        format: 'iife',
        moduleName: 'spec',
        sourceMap: 'inline'
    }

const targets =
{
    async bundle () {
        console.log('target bundle')
        await (await rollup(options)).write(options)
        console.log('... target bundle')
    },

    watch () {
        console.log('target watch')
        require('rollup-watch')({rollup}, options)
            .on('event', event => console.log(event))
        require('livereload').createServer().watch('public')
    },

    start () {
        console.log('target start')
    },

    all () {
        console.log('target all')
        targets.bundle()
    }
}

Object.assign(target, targets)
