import {h, Component} from 'preact'
import {Button, TapMenu, mousePosition, touchPosition} from '@theatersoft/components'
import style from '../App.styl'

export default () => {
    return (
        <section class={style.halfscreen}>
            <TapMenu>
                <Button icon="cross" floating/>
                <Button icon="cross" floating/>
                <Button icon="cross" floating/>
                <Button icon="cross" floating/>
            </TapMenu>
        </section>
    )
}
