'use strict'
require('shelljs/make')

const
    pkg = require('./package.json'),
    name = pkg.name.startsWith('@theatersoft') && pkg.name.slice(13),
    DIST = process.env.DIST === 'true',
    fs = require('fs'),
    copyright = `/*\n${fs.readFileSync('COPYRIGHT', 'utf8')}\n */`,
    {rollup} = require('rollup'),
    //alias = require('rollup-plugin-alias'),
    commonjs = require('rollup-plugin-commonjs'),
    nodeResolve = require('rollup-plugin-node-resolve'),
    babel = require('rollup-plugin-babel')({
        babelrc: false,
        comments: !DIST,
        minified: DIST,
        //presets: [babili],
        plugins: [
            [require("babel-plugin-transform-object-rest-spread"), {useBuiltIns: true}],
            require("babel-plugin-transform-class-properties"),
            [require("babel-plugin-transform-react-jsx"), {pragma: 'h'}],
            //require("babel-plugin-transform-decorators-legacy"),
            // babel-plugin-transform-decorators-legacy provided an invalid property of "default"
            require("babel-plugin-external-helpers"),
        ].concat(DIST ? [
            require("babel-plugin-minify-constant-folding"),
            //FAIL require("babel-plugin-minify-dead-code-elimination"), // es build unusable
            require("babel-plugin-minify-flip-comparisons"),
            require("babel-plugin-minify-guarded-expressions"),
            require("babel-plugin-minify-infinity"),
            require("babel-plugin-minify-mangle-names"),
            require("babel-plugin-minify-replace"),
            //FAIL require("babel-plugin-minify-simplify"),
            require("babel-plugin-minify-type-constructors"),
            require("babel-plugin-transform-member-expression-literals"),
            require("babel-plugin-transform-merge-sibling-variables"),
            require("babel-plugin-transform-minify-booleans"),
            require("babel-plugin-transform-property-literals"),
            require("babel-plugin-transform-simplify-comparison-operators"),
            require("babel-plugin-transform-undefined-to-void")
        ] : [])
    }),
    //replace = require('rollup-plugin-replace'),
    //sourcemaps = require('rollup-plugin-sourcemaps'),
    postcss = require('rollup-plugin-postcss'),
    stylus = require('stylus')

const targets = {
    res () {
        console.log('target res')
        exec('mkdir -p dist/res')
        exec('cp res/*.ttf dist/res')
    },

    css () {
        console.log('target css')
        require('stylus')(fs.readFileSync('styl/ts.styl', 'utf8'))
            .set('compress', false)
            .set('paths', ['styl'])
            .include(require('nib').path)
            .render((err, css) => {
                if (err) throw err
                fs.writeFileSync('dist/components.css', css)
            })
    },

    async bundle () {
        console.log('target bundle')
        exec('rm -f dist/dev/*.js dist/*.js')
        const bundle = await rollup({
            entry: 'src/index.js',
            plugins: [
                postcss({
                    preprocessor: (content, id) => new Promise((resolve, reject) => {
                        const renderer = stylus(content, {
                            filename: id,
                            sourcemap: {inline: true},
                            compress: false,
                            paths: ['styl']
                        })
                        renderer.render((err, code) =>
                            err ? reject(err) : resolve({code, map: renderer.sourcemap})
                        )
                    }),
                    extensions: ['.styl'],
                    //sourceMap: true, // true, "inline" or false
                    extract: `dist/${name}.css`
                }),
                nodeResolve({
                    jsnext: true,
                    module: true,
                    //browser: true, // https://github.com/rollup/rollup-plugin-node-resolve/issues/55
                    main: true,
                }),
                commonjs({
                    include: [
                        'node_modules/**',
                        //'src/**'
                    ]
                }),
                //replace({
                //    'process.env.NODE_ENV': JSON.stringify('production')
                //}),
                //sourcemaps(),
                babel
            ]
        })
        await bundle.write({
            dest: `dist/${name}.es.js`,
            format: 'es',
            moduleName: name,
            banner: copyright,
            sourceMap: !DIST // bus sourcemap must be file to passthrough rollup consumers
        })
        console.log('... target bundle')
    },

    package () {
        console.log('target package')
        const p = Object.assign({}, pkg, {
            main: `main.js`,
            module: `${name}.es.js`,
            private: !DIST,
            devDependencies: undefined,
            distScripts: undefined,
            scripts: pkg.distScripts
        })
        fs.writeFileSync('dist/package.json', JSON.stringify(p, null, '  '), 'utf-8')
        exec('cp LICENSE COPYRIGHT README.md .npmignore dist')
        exec('cp -r index.styl styl dist')
        exec('touch dist/main.js')
    },

    publish () {
        console.log('target publish')
        exec('npm publish --access=public dist')
    },

    watch () {
        require('chokidar').watch('src')
            .on('change', path => {
                console.log(path)
                targets.bundle()
            })
    },

    'watch-css' () {
        require('chokidar').watch('styl')
            .on('change', path => {
                console.log(path)
                targets.css()
            })
    },

    async all () {
        console.log('target all')
        targets.res()
        //targets.css()
        await targets.bundle()
        targets.package()
    }
}

Object.assign(target, targets)
