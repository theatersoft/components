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
    cssExportMap = {},
    postcssImport = require("postcss-import")

const targets =
{
    async bundle () {
        console.log('target bundle')
        const bundle = await rollup({
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
                            getJSON(id, exportTokens) {cssExportMap[id] = exportTokens}
                        }),
                        postcssImport()
                    ],
                    getExport: id => cssExportMap[id]
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
                //sourcemaps(),
                babel({
                    exclude: 'node_modules/**',
                    plugins: [
                        [require("babel-plugin-transform-object-rest-spread"), {useBuiltIns: true}],
                        require("babel-plugin-transform-class-properties"),
                        [require("babel-plugin-transform-react-jsx"), {pragma: 'h'}],
                        //require("babel-plugin-transform-decorators-legacy"),
                        // babel-plugin-transform-decorators-legacy provided an invalid property of "default"
                        require("babel-plugin-external-helpers"),
                    ]
                })
            ]
        })
        await bundle.write({
            dest: 'public/index.js',
            format: 'iife',
            moduleName: 'spec',
            sourceMap: 'inline'
        })
        console.log('... target bundle')
    },

    watch () {
        console.log('target watch')
        const
            watch = require('rollup-watch'),
            watcher = watch({rollup}, options)
        watcher.on('event', event => {
            console.log(event)
        })

        require('chokidar').watch([`${__dirname}/../styl`, `${__dirname}/styl`])
            .on('change', path => {
                console.log(path)
                targets.css()
            })
    },

    reload () {
        console.log('target reload')
        const
            livereload = require('livereload'),
            read = n => {try {return fs.readFileSync(`${process.env.HOME}/.config/theatersoft/${n}`, 'utf8').trim()} catch (e) {}},
            server = livereload.createServer({
                https: {key: read('server.key'), cert: read('server.cer')}
            })
        server.watch('dist/test')
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
