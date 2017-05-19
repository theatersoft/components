import {h, Component} from 'preact'
import './grid.styl'
import './controls.styl'

export const col = col =>
    <div class="col">
        {col}
    </div>

export const cols = cols => cols.map(c => col(c))

export const row = cols =>
    <div class="row">
        {cols}
    </div>

export const rows = rows => rows.map(row =>
    <div class="row">
        {row}
    </div>)

export const grid = rows => rows.map(row =>
    <div class="row">
        {cols(row)}
    </div>)

export const Row = ({children}) =>
    <div class="row">
        {children}
    </div>

export const Col = ({children}) =>
    <div class="col">
        {children}
    </div>

export const RowCols = ({children}) =>
    <div class="row">
        {cols(children)}
    </div>

export const ColRows = ({children}) =>
    <div class="col">
        {rows(children)}
    </div>
