import {h, Component} from 'preact'
import {Button, Ripple, mousePosition, touchPosition} from '..'
import style from './tapmenu.styl'

export const TapMenu = Ripple({centered: false, scaled: false, spread: 100})(class extends Component {
    render ({children, ...props}) {
        const
            onMouseDown = e => {
                console.log('onMouseDown', ...mousePosition(e))
                return props.onMouseDown(e)
            },
            onTouchStart = e => {
                console.log('onTouchStart', ...touchPosition(e))
                return props.onTouchStart(e)
            }
        console.log('TapMenu render', children)
        return (
            <div class={style.field} {...props} {...{onMouseDown, onTouchStart}}>
                {children}
            </div>
        )
    }
})
