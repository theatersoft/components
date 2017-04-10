import {h, render, Component} from 'preact'

// https://preactjs.com/guide/switching-to-preact
const rerender = (n, p = document.getElementById('ui'), r = document.getElementById('ui').lastChild) => render(n, p, r)
export {rerender as render}
export {h, Component} from 'preact'

export {
    Text,
    Icon,
    Row, Col,
    RowCols, ColRows,
    grid,
    row, rows,
    col, cols
} from './controls'

export {Button} from './button'
export {Switch} from './switch'
