import {h, Component} from 'preact'
import {classes} from '../'
import Thumb from './Thumb.js'
import style from './switch.styl'

export const Switch = class extends Component {
    onClick = e => {
        if (!this.props.disabled && this.props.onChange) {
            this.props.onChange(!this.props.checked, e)
        }
        e.stopPropagation()
    }

    render ({class: _class, label, checked = false, disabled = false, onChange, ...props}) {
        return (
            <label class={classes(_class, disabled ? style.disabled : style.field)}>
                <input
                    {...props}
                    type="checkbox"
                    checked={checked}
                    class={style.input}
                    onClick={this.onClick}
                />
                <span class={checked ? style.on : style.off}>
                    <Thumb disabled={disabled}/>
                </span>
                {label && <span>{label}</span>}
            </label>
        )
    }
}
