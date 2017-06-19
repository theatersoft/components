import {h, Component} from 'preact'
import {classes, Icon, Ripple, Col, List, Activable} from '../'
import style from './list.styl'

const ActivableList = Activable()(List)

export const NestedList = Ripple({centered: false, isRipple: true})(class extends Component {
    static defaultProps = {active: false}

    state = {active: this.props.active}

    onClick = () => this.setState({active: !this.state.active})

    render ({icon, label, children, ...props}, {active}) {
        return (
            <Col>
                <li
                    class={classes(props.class, style.item)}
                    onClick={this.onClick}
                    {...props}
                >
                    {icon && <Icon icon={icon} class={style.icon} small/>}
                    <span class={style.content}>
                        <span class={style.text}>
                            {label}
                        </span>
                    </span>
                    {children && children.filter(vnode => vnode.attributes.isRipple)}
                </li>
                {children && <ActivableList active={active}>
                    {children.filter(vnode => !vnode.attributes.isRipple)}
                </ActivableList>}
            </Col>
        )
    }
})
