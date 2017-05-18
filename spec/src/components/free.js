import {h, Component} from 'preact'
import {Button, Ripple, mousePosition, touchPosition} from '@theatersoft/components'
import style from '../App.styl'

export default Ripple({centered: false, scaled: false, spread: 100})(class extends Component {
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
        console.log('free render', children)
        return (
            <section class={style.free} {...props} {...{onMouseDown, onTouchStart}}>
                {children}
            </section>
        )
    }
})
