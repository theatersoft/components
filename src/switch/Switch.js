import {h, Component} from 'preact'
import Thumb from './Thumb.js'
import style from './switch.styl'

export const Switch = class extends Component {
    handleToggle = ev => {
        if (!this.props.disabled && this.props.onChange) {
            this.props.onChange(!this.props.checked, ev)
        }
    }

    render ({label, checked = false, disabled = false}) {
        return (
            <label class={disabled ? style.disabled : style.field}
                   onClick={this.handleToggle}>
                    <span class={checked ? style.on : style.off}>
                        <Thumb disabled={disabled}/>
                    </span>
                {label && <span>{label}</span>}
            </label>
        )
    }
}
