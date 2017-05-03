import {h, render} from 'preact'
import './resize'
import App from './App'
import './index.styl'
import '../res/_icons.svg'
import '@theatersoft/components/components.css'

render(<App />, document.getElementById('ui'))
