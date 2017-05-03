import {h, render} from 'preact'
import '../../src/resize'
import App from '../../src/App'
import './index.styl'
import svg from '../../res/_icons.svg'

const div = document.createElement('div')
div.innerHTML = svg
document.body.appendChild(div)

render(<App />, document.getElementById('ui'))
