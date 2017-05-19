import {h, Component} from 'preact'
import {classes} from '..'
import style from './snackbar.styl'

export class Snackbar extends Component {
    render ({children, ...props}) {
        return h('div', {
                ...props,
                class: classes(props.class)
            },
            children
        )
    }
}
