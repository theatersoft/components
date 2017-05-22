import {h, Component} from 'preact'
import {classes, Activable, Button, Overlay, Portal} from '../'
import style from './dialog.styl'

const Dialog = ({class: _class, active, onOverlayClick, type, title, children, actions}) =>
    <Portal class={style.wrapper}>
        <Overlay class={style.overlay} active={active} onClick={onOverlayClick}/>
        <div class={classes(style.dialog, style[type], {[style.active]: active}, _class)}>
            <section class={style.body}>
                {title && <h6 class={style.title}>{title}</h6>}
                {children}
            </section>
            {actions.length && <nav class={style.navigation}>
                {actions.map((action, i) =>
                    <Button class={classes(style.button, action.class)} key={i}
                        {...action}
                    />
                )}
            </nav>}
        </div>
    </Portal>

Dialog.defaultProps = {
    actions: [],
    active: false,
    type: 'normal'
}

export default Activable()(Dialog)