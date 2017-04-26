import {h, Component} from 'preact'

export class Button extends Component {
    render ({
        accent = false,
        className,
        flat = false,
        floating = false,
        label,
        mini = false,
        neutral = true,
        primary = false,
        raised = false,
        ...others
        }) {
        return (
            <button class="button">
                {label}
            </button>
        )
    }
}