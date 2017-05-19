import {h} from 'preact'
import Button from './components/button'
import Icon from './components/icon'
import TapMenu from './components/tapmenu'
import List from './components/list'
import Snackbar from './components/snackbar'
import Switch from './components/switch'
import './App.styl'

export default () => (
    h('div', {class: "scroll"}
        //,<List/>
        //,<TapMenu/>
        //,<Switch/>
        //,<Icon/>
        //,<Button/>
        ,<Snackbar/>
        //,<Button light/>
        //,<Button/>
    )
)
