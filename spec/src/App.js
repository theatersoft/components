import {h} from 'preact'
import Button from './components/button'
import Icon from './components/icon'
import Switch from './components/switch'
import './App.styl'

export default () => (
    <div class="scroll">
        <Switch/>
        <Icon/>
        <Button/>
        <Button light/>
        <Button/>
    </div>
)
