import {h, Component} from 'preact'
import {classes, Button, Ripple, mousePosition, touchPosition} from '../'
import style from './tapmenu.styl'
import {log} from '@theatersoft/bus'

export const TapMenu = Ripple({centered: false, scaled: false, spread: 100})(class extends Component {
    state = {active: false}

    componentDidUpdate (_prevProps, prevState) {
        if (this.state.active !== prevState.active)
            if (this.props.onActive) this.props.onActive(this.state.active)
    }

    activate = (left, top) => {
        this.setState({active: false, left, top}, () => {
            this.activateTimeout = setTimeout(() => {
                this.setState({active: true})
                this.deactivateTimeout = setTimeout(this.deactivate, 3000)
            }, 10)
        })
    }

    deactivate = () => {
        if (this.deactivateTimeout) clearTimeout(this.deactivateTimeout)
        this.setState({active: false})
    }

    onMouseDown = e => {
        if (!this.state.active) {
            if (!e.defaultPrevented) this.activate(...mousePosition(e))
            this.props.onMouseDown(e)
        }
    }

    onTouchStart = e => {
        //    props.onTouchStart(e)
    }

    onFieldClick = e => {
        if (this.state.active) this.deactivate()
    }

    onKeydown = e => {
        log('TapMenu.onKeydown', e)
        switch (e.key) {
        case 'Enter':
        case 'NumpadEnter':
            if (this.state.active) {
                // TODO focus
                this.deactivate()
            } else {
                const {left, top, height, width} = this.base.getBoundingClientRect()
                this.activate(left + width / 2, top + height / 2)
            }
        }
    }

    componentDidMount = () => {
        this.props.onRef && this.props.onRef(this)
    }

    componentWillUnmount = () => {
        this.props.onRef && this.props.onRef(undefined)
    }

    render ({actions, children, ...props}, {active, left, top}) {
        return (
            <div {...props} class={classes(style.field, props.class)}
                            onMouseDown={this.onMouseDown}
                            onTouchStart={this.onTouchStart}
                            onClick={this.onFieldClick}>
                <div class={classes(style.group, active && style.active)} style={{left, top}}>
                    <div class={style.ring}/>
                    <Button small round inverse
                            class={classes(style.button, style[`button-x`])}
                            onClick={this.onFieldClick}/>
                    {actions.map((action, i) =>
                        <Button large round inverse
                                class={classes(style.button, style[`button-${i}`], action.class)}
                            {...action}
                        />)}
                </div>
                {children}
            </div>
        )
    }
})
