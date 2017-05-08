import {h, Component} from 'preact'
import {classes} from '../classes'
import style from './list.styl'

export class List extends Component {
    render ({children, ...props}) {
        return (
            <ul class={classes(props.class, style.list)}>
                {children}
            </ul>
        )
    }
}