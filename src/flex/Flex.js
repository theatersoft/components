import {h, Component} from 'preact'
import {classes} from '../'
import style from './flex.styl'

export const Row = ({class: _class, end, center, between, around, alignstart, alignend, aligncenter, alignbaseline, children}) =>
    <div class={classes(
        style.row,
        _class,
        end ? style.end : center ? style.center : between ? style.between : around && style.around,
        alignstart ? style.alignstart : alignend ? style.alignend : aligncenter ? style.aligncenter : alignbaseline && style.alignbaseline
    )}>
        {children}
    </div>

export const Col = ({class: _class, end, center, between, around, alignstart, alignend, aligncenter, children}) =>
    <div class={classes(
        style.col,
        _class,
        end ? style.end : center ? style.center : between ? style.between : around && style.around,
        alignstart ? style.alignstart : alignend ? style.alignend : aligncenter && style.aligncenter
    )}>
        {children}
    </div>
