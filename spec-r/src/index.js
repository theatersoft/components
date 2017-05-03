import {h, render} from 'preact'
import '../../spec/src/resize'
import App from '../../spec/src/App'
import './index.styl'
import svg from '../../spec/res/_icons.svg'

const div = document.createElement('div')
div.innerHTML = svg
document.body.appendChild(div)

render(<App />, document.getElementById('ui'))
