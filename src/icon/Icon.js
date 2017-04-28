import {h, Component} from 'preact'
import {classes} from '../classes'
import './icon.styl'

export class Icon extends Component {
    //render ({icon, small, cb, className}) {
    render (props) {
        const {icon, small, cb} = props
        console.log(props)
        return (
            <span
                class={classes('icon', props.class, small && 'small')}
                onClick={e => {e.stopPropagation(); cb && cb()}}
            >
                <svg id={`icon-${icon}`}>
                    <use href={`#svg-${icon}`}/>
                </svg>
            </span>
        )
    }
}