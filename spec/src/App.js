import {h} from 'preact'
import Button from './components/button'
import Dialog from './components/dialog'
import Icon from './components/icon'
import TapMenu from './components/tapmenu'
import List from './components/list'
import Snackbar from './components/snackbar'
import Sheet from './components/sheet'
import Switch from './components/switch'
import style from './App.styl'

export default () => (
    h('div', {class: style.app}
        //,<Sheet/>
        //,<Dialog/>
        //,<Snackbar/>
        ,<List/>
        //,<TapMenu/>
        //,<Switch/>
        //,<Icon/>
        //,<Button/>
        //,<Button light/>
        //,<Button/>
    )
)
