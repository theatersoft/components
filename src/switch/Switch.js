import {h, Component} from 'preact'
import {classes} from '../'
import Thumb from './Thumb.js'
import style from './switch.styl'

export const Switch = class extends Component {
    click = e => {
        this.props.onChange(!this.props.checked, e)
        e.stopPropagation()
    }

    render ({class: _class, checked = false, disabled = false, onChange, ...props}) {
        return (
            <div class={classes(style.switch, disabled && style.disabled, _class)}
                 onclick={!disabled && onChange && this.click}
                {...props}>
                <input class={style.input} type="checkbox" checked={checked}/>
                <span class={checked ? style.on : style.off}>
                    <Thumb disabled={disabled}/>
                </span>
            </div>
        )
    }
}
