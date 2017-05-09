import {h} from 'preact'
import Button from './components/button'
import Icon from './components/icon'
import List from './components/list'
import Switch from './components/switch'
import './App.styl'

export default () => (
    h('div', {class: "scroll"}
        ,<List/>
        ,<Switch/>
        ,<Icon/>
        ,<Button/>
        //,<Button light/>
        //,<Button/>
    )
)
