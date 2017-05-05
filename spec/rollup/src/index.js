import '@theatersoft/components/components.css'
import '../../src/index.styl'
import {h, render} from 'preact'
import '../../src/resize'

import svg from '../../res/_icons.svg'
const div = document.createElement('div')
div.innerHTML = svg
document.body.appendChild(div)

import App from '../../src/App'
render(<App />, document.getElementById('ui'))
