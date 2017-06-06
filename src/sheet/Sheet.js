import {h, Component} from 'preact'
import {classes, Activable, Button, Overlay, Portal} from '../'
import style from './sheet.styl'
import {log} from '@theatersoft/bus'

class Sheet extends Component {
    defaultProps = {
        active: false,
        type: 'left'
    }

    onClick = e => {
        log('onClick')
        e.preventDefault()
        e.stopPropagation()
        if (this.props.onClick) this.props.onClick(e)
    }

    render ({class: _class, active, onClick, type, children}) {
        return (
            <Portal class={style.wrapper}>
                <div class={style.overlay} active={active} onClick={this.onClick}/>
                    <section class={classes(style.sheet, style[type], {[style.active]: active}, _class)}>
                    {children}
                </section>
            </Portal>
        )
    }
}

export default Activable()(Sheet)