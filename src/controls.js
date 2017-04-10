import {h, Component} from 'preact'

//export const Button = (function() {
//    var view = function(c) {
//        return m("div.button", {
//            onclick: c.click
//        }, c.text)
//    }
//    return function(text, click) {
//        this.text = text
//        this.click = click
//        this.m = function() {return dump('Button.render', view(this))}
//    }
//})()

export const Text = ({text, id}) =>
    <div class="text" id={id}>
        <span>{text}</span>
    </div>

export const Icon = ({icon, cb}) =>
    <div class="iconpad" onClick={e => {e.stopPropagation(); cb()}}>
        <svg class="icon" id={`icon-${icon}`}>
            <use href={`#svg-${icon}`}/>
        </svg>
    </div>

//export const Input = (function() {
//    var view = function(c) {
//        return m("input.input", {
//            onchange: m.withAttr("value", c.value),
//            value: c.value()
//        })
//    }
//    return function(v) {
//        this.value = v
//        this.m = function() {return dump('Input.render', view(this))}
//    }
//})()
//
//export const Dialog = function(id, content) {
//    return m('div.inset', [
//        m('div.container#' + id, content.map(function(e) {
//            return e.m ? e.m() : e
//        }))
//    ])
//}

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
