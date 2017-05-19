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
        const addRippleRemoveEventListener = rippleKey => {
            const
                rippleNode = this.rippleNodes[rippleKey],
                onTransitionEnd = e => {
                    if (e.propertyName === 'opacity') {
                        if (this.props.onRippleEnded) this.props.onRippleEnded(e)
                        rippleNode.removeEventListener('transitionend', onTransitionEnd)
                        delete this.rippleNodes[rippleKey]
                        const {[rippleKey]: _, ...ripples} = this.state.ripples
                        this.setState({ripples})
                    }
                }
            if (rippleNode) rippleNode.addEventListener('transitionend', onTransitionEnd)
        }
        if (Object.keys(prevState.ripples).length < Object.keys(this.state.ripples).length)
            addRippleRemoveEventListener(this.currentKey)
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
                            diameter: spread * (scaled ? width : 1)
                        }
                    }
                if (rippleShouldTrigger(isTouch)) {
                    const
                        inactive = Object.keys(this.state.ripples).length === 0,
                        key = multiple || inactive ? getNextKey() : this.currentKey,
                        started = executor(),
                        eventType = isTouch ? 'touchend' : 'mouseup',
                        endRipple = () => {
                            document.removeEventListener(eventType, endRipple)
                            started.promise.then(() => this.setState({
                                ripples: {
                                    ...this.state.ripples,
                                    [key]: {...this.state.ripples[key], active: false}
                                }
                            }))
                        }
                    document.addEventListener(eventType, endRipple)
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
                <span key={key} class={style.rippleWrapper || "rippleWrapper"} {...props}>
                    <span
                        class={classes(style.ripple, {[style.rippleActive]: active, [style.rippleRestarting]: restarting}, _class)}
                        style={{transform: `translate3d(${-diameter / 2 + left}px, ${-diameter / 2 + top}px, 0) scale(${restarting ? 0 : 1})`, width: diameter, height: diameter}}
                        ref={node => {if (node) this.rippleNodes[key] = node}}
                    />
                </span>,
            doRipple = !disabled && ripple,
            onMouseDown = e => {
                if (this.props.onMouseDown) this.props.onMouseDown(e)
                if (doRipple) animateRipple(...mousePosition(e), false)
            },
            onTouchStart = e => {
                if (this.props.onTouchStart) this.props.onTouchStart(e)
                if (doRipple) animateRipple(...touchPosition(e), true)
            }
        return h(ComposedComponent, {
                ...doRipple && {onMouseDown, onTouchStart},
                disabled,
                ...other
            }, [children, Object.entries(ripples).map(([k, v]) => renderRipple(k, _class, v))]
        )
    }
}
