import {h, Component} from 'preact'
import {Button, TapMenu, mousePosition, touchPosition} from '@theatersoft/components'
import style from '../App.styl'

const actions = [
    {tooltip: 'one', icon: 'cross'},
    {tooltip: 'two', icon: 'cross'},
    {tooltip: 'three', icon: 'cross'},
    {tooltip: 'four', icon: 'cross'}
]

export default () => {
    return (
        <section class={style.halfscreen}>
            <TapMenu actions={actions}/>
        </section>
    )
}
