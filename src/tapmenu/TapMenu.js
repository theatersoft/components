import {h, Component} from 'preact'
import {classes, Button, Ripple, mousePosition, touchPosition} from '../'
import style from './tapmenu.styl'

const log = (...x) => (console.log(...x), x[0])

export const TapMenu = Ripple({centered: false, scaled: false, spread: 100})(class extends Component {
    state = {active: false}

    activate = (left, top) => {
        this.setState({active: false, left, top}, () => {
            this.activateTimeout = setTimeout(() => this.setState({active: true}), 100)
        })
    }

    deactivate = () => {
        this.setState({active: false})
    }

    onMouseDown = e => {
        console.log('onMouseDown', ...mousePosition(e))
        if (!this.state.active) {
            this.activate(...mousePosition(e))
            this.props.onMouseDown(e)
        }
    }

    onTouchStart = e => {
        console.log('onTouchStart', ...touchPosition(e))
        //    props.onTouchStart(e)
    }

    onFieldClick = e => {
        if (this.state.active) this.deactivate()
    }

    onButtonClick = e => {
        e.stopPropagation()
        log(e)
        //action
    }

    render ({actions, children, ...props}, {active, left, top}) {
        return (
            <div class={style.field} {...props}
                 onMouseDown={this.onMouseDown}
                 onTouchStart={this.onTouchStart}
                 onClick={this.onFieldClick}
            >
                <div
                    class={classes(style.group, active && style.active)}
                    style={{left, top}}
                >
                    <Button
                        class={classes(style.button, style[`button-x`])}
                        small round inverse
                        onClick={this.onFieldClick}
                    />
                    {actions.map((action, i) =>
                        <Button
                            class={classes(style.button, style[`button-${i}`], action.class)}
                            large round inverse key={i}
                            {...action}
                            onClick={this.onButtonClick}
                        />)}
                </div>
                {children}
            </div>
        )
    }
})
