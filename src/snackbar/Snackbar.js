import {h, Component} from 'preact'
import {classes, Activable, Button, Portal} from '../'
import style from './snackbar.styl'

export default Activable()(class Snackbar extends Component {
    componentDidMount () {
        if (this.props.active && this.props.timeout) this.setTimeout(this.props)
    }

    componentWillReceiveProps (nextProps) {
        if (nextProps.active && nextProps.timeout) this.setTimeout(nextProps)
    }

    componentWillUnmount () {clearTimeout(this.curTimeout)}

    setTimeout = ({onTimeout, timeout}) => {
        if (this.curTimeout) clearTimeout(this.curTimeout)
        this.curTimeout = setTimeout(() => {
            if (onTimeout) onTimeout()
            this.curTimeout = null
        }, timeout)
    }

    render ({class: _class, type, action, active, children, label, onClick}) {
        return (
            <Portal className={style.portal}>
                <div class={classes(style.snackbar, {[style.active]: active}, {[style[type]]: !!type}, _class)}>
                    <span class={style.label}>
                        {label}
                        {children}
                    </span>
                    {action && <Button class={style.button} label={action} onClick={onClick}/>}
                </div>
            </Portal>
        )
    }
})
