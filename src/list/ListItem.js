import {h, Component} from 'preact'
import {classes, Icon, Ripple} from '../'
import style from './list.styl'

const
    stop = e => e.stopPropagation(),
    Action = vnode => <span class={style.action} onMouseDown={stop} onClick={stop}>{vnode}</span>

export const ListItem = Ripple({centered: false, isRipple: true})(class extends Component {
    render ({icon, label, children, ...props}) {
        return (
            <li class={classes(props.class, style.item)} {...props}>
                {icon && <Icon icon={icon} class={style.icon} small disabled={props.disabled}/>}
                <span class={style.content}>
                    <span class={style.text}>
                        {label}
                    </span>
                </span>
                {children && children.map(vnode => vnode && !vnode.attributes.isRipple ? Action(vnode) : vnode)}
            </li>
        )
    }
})
