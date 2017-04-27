import {h, Component} from 'preact'
import {Icon} from '../icon'
import {classes} from '../classes'

export class Button extends Component {
    render ({
        accent = false,
        className,
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
                primary ? 'primary' : accent && 'accent',
                raised ? 'raised' : floating && 'floating',
                {inverse},
                {mini}
            )}>
                {icon && <Icon icon={icon}/>}
                {label}
            </button>
        )
    }
}