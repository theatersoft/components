import {h, Component} from 'preact'
import {classes, Button, Ripple, mousePosition, touchPosition} from '../'
import style from './tapmenu.styl'

const log = (...x) => (console.log(...x), x[0])

export const TapMenu = Ripple({centered: false, scaled: false, spread: 100})(class extends Component {
    state = {active: false}

    render ({actions, children, ...props}, {active, left, top}) {
        const
            activate = (left, top) => {
                this.setState({active: false, left, top}, () => {
                    this.activateTimeout = setTimeout(() => this.setState({active: true}), 100)
                })
            },
            deactivate = () => {
                this.setState({active: false})
            },
            onMouseDown = e => {
                console.log('onMouseDown', ...mousePosition(e))
                if (!active) {
                    activate(...mousePosition(e))
                    props.onMouseDown(e)
                } else deactivate()
            },
            onTouchStart = e => {
                console.log('onTouchStart', ...touchPosition(e))
                //    props.onTouchStart(e)
            }
        return (
            <div class={style.field} {...props} {...{onMouseDown, onTouchStart}}>
                <div
                    class={classes(style.group, {[style.active]: active})}
                    style={{left, top}}
                >
                    {actions.map((action, i) =>
                        <Button
                            class={classes(style.button, style[`button-${i}`], action.class)}
                            round inverse key={i}
                            {...action}
                            onClick={e => deactivate()}
                        />)}
                </div>
                {children}
            </div>
        )
    }
})
