import {h, Component} from 'preact'
import {classes} from '../classes'
import './icon.styl'

export class Icon extends Component {
    render ({icon, small, cb}) {
        return (
            <div
                class={classes('icon', small && 'small')}
                onClick={e => {e.stopPropagation(); cb && cb()}}
            >
                <svg id={`icon-${icon}`}>
                    <use href={`#svg-${icon}`}/>
                </svg>
            </div>
        )
    }
}