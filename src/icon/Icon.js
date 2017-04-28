import {h, Component} from 'preact'
import {classes} from '../classes'
import './icon.styl'

export class Icon extends Component {
    render (props) {
        const {icon, small, cb} = props
        return (
            <span
                class={classes('icon', props.class, small && 'small')}
                onClick={cb}>
                <svg id={`icon-${icon}`}>
                    <use href={`#svg-${icon}`}/>
                </svg>
            </span>
        )
    }
}