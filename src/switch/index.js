import {h, Component} from 'preact'
//import rippleFactory from './Ripple.js'
import thumbFactory from './Thumb.js'

export const switchFactory = (Thumb) => {
    return class extends Component {
        handleToggle = ev => {
            console.log('handleToggle', this.props, ev)
            if (!this.props.disabled && this.props.onChange) {
                this.props.onChange(!this.props.checked, ev)
            }
        }

        render ({label, checked = false, disabled = false}) {
            return (
                <label class={disabled ? 'sw disabled' : 'sw field'}
                        onClick={this.handleToggle}>
                    <span class={checked ? 'on' : 'off'}>
                        <Thumb disabled={disabled}/>
                    </span>
                    {label && <span class='sw-label'>{label}</span>}
                </label>
            )
        }
    }
}

//const Thumb = thumbFactory(rippleFactory({ centered: true, spread: 2.6 }))

export const Switch = switchFactory(thumbFactory(x => x))
