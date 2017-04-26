import {h, Component} from 'preact'

export class Switch extends Component {
    render ({
        accent = false,
        className,
        flat = false,
        floating = false,
        mini = false,
        neutral = true,
        primary = false,
        raised = false,
        ...others
        }) {
        return (
            <button class="button">
                {text}
            </button>
        )
    }
}