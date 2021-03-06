import {h, Component} from 'preact'
import {classes, Icon, Ripple, List, Activable} from '../'
import style from './list.styl'

const ActivableList = Activable()(List)

export const NestedList = Ripple({centered: false, isRipple: true})(class extends Component {
    static defaultProps = {active: false}

    state = {active: false, activate: this.props.active}

    onClick = () => this.setState({active: !this.state.active})

    componentDidMount () {
        if (this.state.activate) this.setState({active: true})
    }

    componentDidUpdate () {
        const {active} = this.state
        if (this.list.base)
            if (active && this.list.base.getBoundingClientRect) {
                const {height} = this.list.base.getBoundingClientRect()
                this.list.base.parentElement.style.maxHeight = `${height}px`
            } else
                this.list.base.parentElement.style.maxHeight = '0'
    }

    render ({icon, label, children, ...props}, {active}) {
        const
            ripples = children.filter(vnode => vnode && vnode.attributes && vnode.attributes.isRipple),
            items = children.filter(vnode => vnode && (!vnode.attributes || !vnode.attributes.isRipple))
        return (
            <div>
                <li class={classes(props.class, style.item)} onClick={this.onClick} {...props}>
                    {icon && <Icon icon={icon} class={style.icon} small/>}
                    <span class={style.content}>
                        <span class={style.text}>
                            {label}
                        </span>
                    </span>
                    {ripples}
                </li>
                <div class={classes(style.nested, active && style.active)}>
                    <ActivableList active={active} ref={ref => this.list = ref}>
                        {items}
                    </ActivableList>
                </div>
            </div>
        )
    }
})
