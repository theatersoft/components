import {h, Component} from 'preact'
import {Icon} from '../icon'
import {classes} from '../classes'
import style from './button.styl'
import Ripple from '../ripple'

export const Button = Ripple({centered: false})(
    class extends Component {
        render ({icon, label, inverse, mini, primary, accent, floating, raised, class: _class, ...props}) {
            return (
                <button class={classes(
                _class,
                primary ? style.primary : accent ? style.accent : style.neutral,
                raised ?  style.raised : floating ?  style.floating : style.flat,
                inverse && style.inverse,
                mini && style.mini
            )} {...props}>
                    {icon && <Icon icon={icon} class={style.icon} small disabled={props.disabled} />}
                    {label}
                </button>
            )
        }
    })
