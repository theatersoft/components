import {h, Component} from 'preact'
import {Icon} from '../icon'
import {classes} from '../classes'
import style from './button.styl'

export class Button extends Component {
    render (props) {
        const {
            accent = false,
            disabled,
            floating = false,
            icon,
            inverse,
            label,
            mini = false,
            primary = false,
            raised = false,
            ...others
            } = props
        return (
            <button class={classes(
                props.class,
                primary ? style.primary : accent ? style.accent : style.neutral,
                raised ?  style.raised : floating ?  style.floating : style.flat,
                inverse && style.inverse,
                mini && style.mini
            )} {...{disabled}}>
                {icon && <Icon icon={icon} class={style.icon}/>}
                {label}
            </button>
        )
    }
}