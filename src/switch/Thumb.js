import {h, Component} from 'preact'
import style from './switch.styl'

export default ripple => ripple(
    ({onMouseDown, ...other}) => (
        <span class={style.thumb} onMouseDown={onMouseDown} {...other} />
    )
)
