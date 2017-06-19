import {h, Component} from 'preact'
import {classes, Icon, Ripple} from '..'
import style from './list.styl'

const Action = vnode => {
    const
        //{onClick, onMouseDown} = vnode.attributes,
        //stopRipple = onClick && !onMouseDown
        stop = e => e.stopPropagation()
    return (
        <span class={style.action} onMouseDown={stop}>
            {vnode}
        </span>
    )
}

export const NestedList = Ripple({centered: false, isRipple: true})(class extends Component {
    render ({icon, label, children, ...props}) {
        return h('li', {...props, class: classes(props.class, style.item)},
            icon && <Icon icon={icon} class={style.icon} small disabled={props.disabled}/>,
            <span class={style.content}><span class={style.text}>{label}</span></span>,
            children && children.map(vnode => !vnode.attributes.isRipple ? Action(vnode) : vnode)
        )
    }
})
