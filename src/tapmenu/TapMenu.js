import {h, Component} from 'preact'
import {classes, Button, Ripple, mousePosition, touchPosition} from '../'
import style from './tapmenu.styl'

const log = x => (console.log(x), x)

export const TapMenu = Ripple({centered: false, scaled: false, spread: 100})(class extends Component {
    state = {active: false}

    render ({actions, children, ...props}, {active}) {
        const
            activate = () => this.setState({active: true}),
            onMouseDown = e => {
                console.log('onMouseDown', ...mousePosition(e))
                if (!active) {
                    activate()
                    props.onMouseDown(e)
                }
            },
            onTouchStart = e => {
                console.log('onTouchStart', ...touchPosition(e))
                props.onTouchStart(e)
            }
        return (
            <div class={style.field} {...props} {...{onMouseDown, onTouchStart}}>
                <div class={classes(style.group, {[style.active]: active})}>
                    {actions.map((action, i) =>
                        <Button class={classes(style.button, style[`button-${i}`], action.class)} floating mini key={i}
                            {...action}
                            onClick={e=>console.log(e)}
                        />)}
                </div>
                {children}
            </div>
        )
    }
})
