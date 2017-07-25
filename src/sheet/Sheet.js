import {h, Component} from 'preact'
import {classes, Activable, Button, Overlay, Portal} from '../'
import style from './sheet.styl'

class Sheet extends Component {
    static defaultProps = {
        active: false,
        type: 'bottom'
    }

    onClick = e => {
        if (this.props.onClick) this.props.onClick(e)
    }

    render ({class: _class, active, onClick, type, children, index}) {
        console.log(children)
        return (
            <Portal class={style.wrapper}>
                <div class={style.overlay} onClick={this.onClick}/>
                {index === undefined
                    ?
                    <section class={classes(style.sheet, style[type], active && style.active, _class)}>
                        {children}
                    </section>
                    :
                    children.map((child, i) =>
                        <section
                            class={classes(style.sheet, style[type], i <= index && active && style.active, i < index && style.deactive, _class)}>
                            {[child]}
                        </section>
                    )}
            </Portal>
        )
    }
}

export default Activable()(Sheet)