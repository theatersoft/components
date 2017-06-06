import {h, Component} from 'preact'
import {classes, Activable, Button, Overlay, Portal} from '../'
import style from './sheet.styl'
import {log} from '@theatersoft/bus'

class Sheet extends Component {
    static defaultProps = {
        active: false,
        type: 'bottom'
    }

    onClick = e => {
        log('Sheet.onClick')
        if (this.props.onClick) this.props.onClick(e)
    }

    render ({class: _class, active, onClick, type, children}) {
        return (
            <Portal class={style.wrapper}>
                <div class={style.overlay} onClick={this.onClick}/>
                    <section class={classes(style.sheet, style[type], active && style.active, _class)}>
                    {children}
                </section>
            </Portal>
        )
    }
}

export default Activable()(Sheet)