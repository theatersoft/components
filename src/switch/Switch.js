import {h, Component} from 'preact'
import Ripple from '../ripple'
import thumbFactory from './Thumb.js'
import style from './switch.styl'

const switchFactory = Thumb => class extends Component {
    handleToggle = ev => {
        console.log('handleToggle', this.props, ev)
        if (!this.props.disabled && this.props.onChange) {
            this.props.onChange(!this.props.checked, ev)
        }
    }

    render ({label, checked = false, disabled = false}) {
        return (
            <label class={disabled ? style.disabled : style.field}
                   onClick={this.handleToggle}>
                    <span class={checked ? style.on : style.off}>
                        {h(Thumb, {disabled})}
                    </span>
                {label && <span>{label}</span>}
            </label>
        )
    }
}

// ^^^ TODO dist build mangles Thumb argument, breaks JSX:
//                         <Thumb disabled={disabled}/>

export const Switch = switchFactory(thumbFactory(Ripple({centered: true, spread: 4.2})))
