import {h, Component} from 'preact'
import style from './switch.styl'
import Ripple from '../ripple'

export default Ripple({centered: true, spread: 4.2})(props =>
    <span class={style.thumb} {...props}/>
)
