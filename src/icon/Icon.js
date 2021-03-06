import {h, Component} from 'preact'
import {classes} from '..'
import './icon.styl'

export class Icon extends Component {
    render (props) {
        const {icon, small, cb} = props
        return (
            <span
                class={classes('icon', props.class, small && 'small')}
                onClick={cb}>
                <svg>
                    <use href={`#svg-${icon}`}/>
                </svg>
            </span>
        )
    }
}