import {h, Component} from 'preact'
import {Icon} from '../icon'

export class Button extends Component {
    render ({
        accent = false,
        className,
        flat = false,
        floating = false,
        icon,
        label,
        mini = false,
        neutral = true,
        primary = false,
        raised = false,
        ...others
        }) {
        return (
            <button class="button">
                {icon && <Icon icon={icon}/>}
                {label}
            </button>
        )
    }
}