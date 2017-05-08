import {h, Component} from 'preact'
import {classes} from '../classes'
import style from './list.styl'

export class ListItem extends Component {
    render ({icon, label, children, ...props}) {
        return h('li', {
                ...props,
                class: classes(props.class, style.item)
            },
            label && <span>{label}</span>,
            children
        )
    }
}