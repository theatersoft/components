import {h, Component} from 'preact'
import {Icon} from '../icon'
import {classes} from '../classes'
import style from './button.styl'

export class Button extends Component {
    render ({
        accent = false,
        className,
        disabled,
        floating = false,
        icon,
        inverse,
        label,
        mini = false,
        primary = false,
        raised = false,
        ...others
        }) {
        return (
            <button class={classes(
                className,
                primary ? style.primary : accent && style.accent,
                raised ?  style.raised : floating &&  style.floating,
                inverse && style.inverse,
                mini && style.mini
            )} {...{disabled}}>
                {icon && <Icon icon={icon}/>}
                {label}
            </button>
        )
    }
}