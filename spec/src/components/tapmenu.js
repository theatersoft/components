import {h, Component} from 'preact'
import {Button, TapMenu, mousePosition, touchPosition} from '@theatersoft/components'
import style from '../App.styl'

const actions = [
    {tooltip: 'one', icon: 'logo'},
    {tooltip: 'two', icon: 'list'},
    {tooltip: 'three', icon: 'thermometer'},
    {tooltip: 'four', icon: 'spinner'}
]

export default () => {
    return (
        <section class={style.halfscreen}>
            <TapMenu actions={actions}/>
        </section>
    )
}
