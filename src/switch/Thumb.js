import {h, Component} from 'preact'
import style from './switch.styl'

export default ripple => ripple(props =>
    <span class={style.thumb} {...props}/>
)
