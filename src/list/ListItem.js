import {h, Component} from 'preact'
import {Icon} from '../icon'
import {classes} from '../classes'
import style from './list.styl'

export class ListItem extends Component {
    render ({icon, label, children, ...props}) {
        return h('li', {
                ...props,
                class: classes(props.class, style.item)
            },
            <span>{icon && <Icon icon={icon} class={style.icon} small disabled={props.disabled}/>}</span>,
            <span>{label}</span>,
            <span>{children}</span>
        )
    }
}