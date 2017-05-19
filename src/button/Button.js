import {h, Component} from 'preact'
import {classes, Icon, Ripple} from '..'
import style from './button.styl'

export const Button = Ripple({centered: false})(
    class extends Component {
        render ({icon, label, inverse, mini, primary, accent, floating, raised, children, ...props}) {
            return h('button', {
                    ...props,
                    class: classes(
                        props.class,
                        primary ? style.primary : accent ? style.accent : style.neutral,
                        raised ? style.raised : floating ? style.floating : style.flat,
                        inverse && style.inverse,
                        mini && style.mini
                    )
                },
                icon && <Icon icon={icon} class={style.icon} small disabled={props.disabled}/>,
                label,
                children
            )
        }
    })
