import {h, Component} from 'preact'
import {classes, Button, Ripple, mousePosition, touchPosition} from '../'
import style from './tapmenu.styl'

export const TapMenu = Ripple({centered: false, scaled: false, spread: 100})(class extends Component {
    render ({actions, children, ...props}) {
        const
            onMouseDown = e => {
                console.log('onMouseDown', ...mousePosition(e))
                return props.onMouseDown(e)
            },
            onTouchStart = e => {
                console.log('onTouchStart', ...touchPosition(e))
                return props.onTouchStart(e)
            }
        return (
            <div class={style.field} {...props} {...{onMouseDown, onTouchStart}}>
                <div class={style.group}>
                    {actions.map((action, i) =>
                        <Button class={classes(style.button, action.class)} floating mini key={i}
                            {...action}
                        />)}
                </div>
                {children}
            </div>
        )
    }
})
