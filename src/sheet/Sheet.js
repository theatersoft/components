import {h, Component} from 'preact'
import {classes} from '../classes'
import './sheet.styl'

export class Sheet extends Component {
    render ({children, ...props}) {
        return (
            <div class={classes('sheet', props.class)}>
                {children}
            </div>
        )
    }
}