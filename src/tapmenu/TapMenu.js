import {h, Component} from 'preact'
import {classes, Button, Ripple, mousePosition, touchPosition} from '../'
import style from './tapmenu.styl'
//import {log} from '@theatersoft/bus'

const keyIndex = {'ArrowUp': 0, 'ArrowRight': 1, 'ArrowDown': 2, 'ArrowLeft': 3}

export const TapMenu = Ripple({centered: false, scaled: false, spread: 100})(class extends Component {
    state = {active: false}

    buttons = []

    componentDidUpdate (_prevProps, prevState) {
        if (this.state.active !== prevState.active)
            if (this.props.onActive) this.props.onActive(this.state.active)
    }

    restartTimeout = () => {
        if (this.deactivateTimeout) clearTimeout(this.deactivateTimeout)
        this.deactivateTimeout = setTimeout(this.deactivate, 3000)
    }

    activate = (left, top) => {
        this.setState({active: false, left, top}, () => {
            this.activateTimeout = setTimeout(() => {
                this.setState({active: true})
                this.restartTimeout()
            }, 10)
        })
    }

    deactivate = () => {
        if (this.deactivateTimeout) clearTimeout(this.deactivateTimeout)
        this.setState({active: false})
    }

    pointerDown = e => {
        if (!this.state.active && !this.context.focus) {
            if (!e.defaultPrevented) this.activate(e.pageX, e.pageY)
            this.props.onPointerDown(e)
        }
    }

    onFieldClick = e => {
        if (this.state.active) this.deactivate()
    }

    onKeydown = e => {
        //log('TapMenu.onKeydown', e)
        this.restartTimeout()
        switch (e.key) {
        case 'Escape':
            if (this.state.active) this.deactivate()
            break
        case 'Enter':
        case 'NumpadEnter':
            if (this.state.active) this.deactivate()
            else {
                const {left, top, height, width} = this.base.getBoundingClientRect()
                this.activate(left + width / 2, top + height / 2)
            }
            break
        default:
            if (this.state.active) {
                const button = this.buttons[keyIndex[e.key]]
                if (button) button.focus()
            }
        }
    }

    onGesture = e => {
        const {type} = e
        //log('TapMenu.onGesture', type, e)
        if (!this.state.active && (type === 'press' || type === 'tap')) {
            this.activate(...mousePosition(e.srcEvent))
            if (this.props.onMouseDown) this.props.onMouseDown(e.srcEvent)
        }
    }

    componentDidMount = () => {
        this.props.onRef && this.props.onRef(this)
        if (this.context.focus) this.context.focus.on('gesture', this.onGesture)
    }

    componentWillUnmount = () => {
        this.props.onRef && this.props.onRef(undefined)
        if (this.context.focus) this.context.focus.off('gesture', this.onGesture)
    }

    render ({actions, children, ...props}, {active, left, top}) {
        return (
            <div {...props} class={classes(style.field, props.class)}
                            onPointerDown={this.pointerDown}
                            onClick={this.onFieldClick}>
                <div class={classes(style.group, active && style.active)} style={{left, top}}>
                    <div class={style.ring}/>
                    <Button small round inverse
                            class={classes(style.button, style[`button-x`])}
                            onClick={this.onFieldClick}/>
                    {actions.map((action, i) =>
                        <Button large round inverse
                                class={classes(style.button, style[`button-${i}`], action.class)}
                                ref={ref => this.buttons[i] = ref && ref.base}
                            {...action}
                        />)}
                </div>
                {children}
            </div>
        )
    }
})
