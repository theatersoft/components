import {h, Component} from 'preact'
import {Icon} from '../icon'
import {classes} from '../classes'
import style from './list.styl'
import Ripple from '../ripple'

const Action = vnode => {
    const
        {onClick, onMouseDown} = vnode.attributes,
        stop = e =>e.stopPropagation()
    return (
        <span class={style.action} onMouseDown={stop} onClick={stop}>
            {vnode}
        </span>
    )
}

export const ListItem = Ripple({centered: false, isRipple: true})(class extends Component {
    render ({icon, label, children, ...props}) {
        return h('li', {...props, class: classes(props.class, style.item)},
            icon && <Icon icon={icon} class={style.icon} small disabled={props.disabled}/>,
            <span class={style.content}><span class={style.text}>{label}</span></span>,
            children && children.map(vnode => !vnode.attributes.isRipple ? Action(vnode) : vnode)
        )
    }
})
