import {h, Component} from 'preact'
import {classes} from '../'
import style from './indicator.styl'

export const Indicator = ({class: _class, normal, warning, error}) => (
    <span
        class={classes(_class, style.thumb, normal ? style.normal : warning ? style.warning : error && style.error)}
    />
)
