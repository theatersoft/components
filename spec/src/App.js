import {h} from 'preact'
import Button from './components/button'
import Icon from './components/icon'
import Free from './components/free'
import TapMenu from './components/tapmenu'
import List from './components/list'
import Switch from './components/switch'
import './App.styl'

export default () => (
    h('div', {class: "scroll"}
        ,<List/>
        ,<Free/>
        ,<TapMenu/>
        ,<Switch/>
        ,<Icon/>
        ,<Button/>
        //,<Button light/>
        //,<Button/>
    )
)
