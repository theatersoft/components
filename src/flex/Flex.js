import {h, Component} from 'preact'
import {classes} from '../'
import style from './flex.styl'

export const Row = ({class: _class, end, center, between, around, children}) =>
    <div class={classes(
        style.row,
        _class,
        end ? style.end : center ? style.center : between ? style.between : around && style.around
    )}>
        {children}
    </div>

export const Col = ({class: _class, end, center, between, around, children}) =>
    <div class={classes(
        style.col,
        _class,
        end ? style.end : center ? style.center : between ? style.between : around && style.around
    )}>
        {children}
    </div>