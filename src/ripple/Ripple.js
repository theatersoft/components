import {h, Component} from 'preact'
import style from './ripple.styl'
import {classes, mousePosition, touchPosition} from '..'
import {executor} from '@theatersoft/bus'

export default ({centered = false, class: _class, multiple = true, scaled = true, spread = 2, ...props}) => ComposedComponent => class extends Component {
    static defaultProps = {disabled: false, ripple: {centered, _class, multiple, scaled, spread}}

    constructor () {
        super()
        this.state = {ripples: {}}
        this.rippleNodes = {}
        this.currentCount = 0
    }

    componentDidUpdate (prevProps, prevState) {
        if (Object.keys(prevState.ripples).length < Object.keys(this.state.ripples).length) {
            const
                key = this.currentKey,
                node = this.rippleNodes[key],
                onTransitionEnd = e => {
                    if (e.propertyName === 'opacity') {
                        if (this.props.onRippleEnded) this.props.onRippleEnded(e)
                        node.removeEventListener('transitionend', onTransitionEnd)
                        delete this.rippleNodes[key]
                        const {[key]: _, ...ripples} = this.state.ripples
                        this.setState({ripples})
                    }
                }
            if (node) node.addEventListener('transitionend', onTransitionEnd)
        }
    }

    componentWillUnmount () {Object.values(this.state.ripples).forEach(v => v.endRipple())}

    render ({disabled, ripple, onRippleEnded, children, ...other}, {ripples}) {
        const
            {_class, centered, multiple, scaled, spread} = ripple,
            animateRipple = (x, y, isTouch) => {
                const
                    getNextKey = () => (this.currentKey = `ripple${++this.currentCount}`),
                    rippleShouldTrigger = isTouch => {
                        const shouldStart = isTouch || !this.touchCache
                        this.touchCache = isTouch
                        return shouldStart
                    },
                    getDescriptor = (x, y) => {
                        const {left, top, height, width} = this.base.getBoundingClientRect()
                        return {
                            left: centered ? 0 : x - left - width / 2,
                            top: centered ? 0 : y - top - height / 2,
                            diameter: spread * (scaled ? Math.min(width, height) : 1)
                        }
                    }
                if (rippleShouldTrigger(isTouch)) {
                    const
                        inactive = Object.keys(this.state.ripples).length === 0,
                        key = multiple || inactive ? getNextKey() : this.currentKey,
                        started = executor(),
                        eventTypes = isTouch ? ['touchend', 'touchmove'] : ['mouseup'],
                        endRipple = () => {
                            for (const type of eventTypes) document.removeEventListener(type, endRipple)
                            started.promise.then(() => this.setState({
                                ripples: {
                                    ...this.state.ripples,
                                    [key]: {...this.state.ripples[key], active: false}
                                }
                            }))
                        }
                    for (const type of eventTypes) document.addEventListener(type, endRipple)
                    this.setState({ripples: {...this.state.ripples, [key]: {active: false, restarting: true, endRipple, ...getDescriptor(x, y)}}},
                        () => {
                            started.resolve()
                            if (this.rippleNodes[key]) this.rippleNodes[key].offsetWidth
                            this.setState({
                                ripples: {
                                    ...this.state.ripples,
                                    [key]: {...this.state.ripples[key], active: true, restarting: false}
                                }
                            })
                        }
                    )
                }
            },
            renderRipple = (key, _class, {active, restarting, top, left, diameter}) =>
                <div key={key} class={style.rippleWrapper || "rippleWrapper"} {...props}>
                    <div
                        class={classes(style.ripple, {[style.rippleActive]: active, [style.rippleRestarting]: restarting}, _class)}
                        style={{transform: `translate3d(${-diameter / 2 + left}px, ${-diameter / 2 + top}px, 0) scale(${restarting ? 0 : 1})`, width: diameter, height: diameter}}
                        ref={node => {if (node) this.rippleNodes[key] = node}}
                    />
                </div>,
            onMouseDown = e => {
                if (this.props.onMouseDown) this.props.onMouseDown(e)
                animateRipple(...mousePosition(e), false)
            },
            onTouchStart = e => {
                if (this.props.onTouchStart) this.props.onTouchStart(e)
                animateRipple(...touchPosition(e), true)
            }
        return h(ComposedComponent,
            {
                ...other,
                ...ripple && !disabled && {onMouseDown, onTouchStart},
                disabled
            },
            children,
            Object.entries(ripples).map(([k, v]) => renderRipple(k, _class, v))
        )
    }
}
