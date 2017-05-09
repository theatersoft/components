import {h, Component} from 'preact'
import {Icon} from '../icon'
import {classes} from '../classes'
import style from './list.styl'
import Ripple from '../ripple'

export const ListItem = Ripple({centered: false})(class extends Component {
    render ({icon, label, children, ...props}) {
        return h('li', {
                ...props,
                class: classes(props.class, style.item)
            },
            <span>{icon && <Icon icon={icon} class={style.icon} small disabled={props.disabled}/>}</span>,
            <span>{label}</span>,
            {children}
        )
    }
})