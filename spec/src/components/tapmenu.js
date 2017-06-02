import {h, Component} from 'preact'
import {Button, TapMenu, mousePosition, touchPosition} from '@theatersoft/components'
import style from '../App.styl'

const actions = ['logo', 'list', 'thermometer', 'spinner'].map(a => ({icon: a, tooltip: a, onClick: e => console.log(a, e)}))

export default () => {
    return (
        <section class={style.halfscreen}>
            <TapMenu actions={actions}/>
        </section>
    )
}
