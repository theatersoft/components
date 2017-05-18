import {h, Component} from 'preact'
import style from './ripple.styl'
import {classes} from '../classes'
import {executor} from '@theatersoft/bus'

export const mousePosition = event => ([
    event.pageX - (window.scrollX || window.pageXOffset),
    event.pageY - (window.scrollY || window.pageYOffset)
])
export const touchPosition = event => ([
    event.touches[0].pageX - (window.scrollX || window.pageXOffset),
    event.touches[0].pageY - (window.scrollY || window.pageYOffset)
])

export default ({
    centered: defaultCentered = false,
    class: defaultClass = '',
    multiple: defaultMultiple = true,
    spread: defaultSpread = 2,
    ...props
    }) => ComposedComponent => class extends Component {
    static defaultProps = {
        disabled: false,
        ripple: true,
        rippleCentered: defaultCentered,
        rippleClass: defaultClass,
        rippleMultiple: defaultMultiple,
        rippleSpread: defaultSpread
    }

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
            if (rippleNode)
                rippleNode.addEventListener('transitionend', onTransitionEnd)
        }
        if (Object.keys(prevState.ripples).length < Object.keys(this.state.ripples).length)
            addRippleRemoveEventListener(this.currentKey)
    }

    componentWillUnmount () {Object.values(this.state.ripples).forEach(v => v.endRipple())}

    render ({ripple, rippleClass, disabled, onRippleEnded, rippleCentered, rippleMultiple, rippleSpread, children, ...other}, {ripples}) {
        const
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
                            left: rippleCentered ? 0 : x - left - width / 2,
                            top: rippleCentered ? 0 : y - top - height / 2,
                            width: width * rippleSpread
                        }
                    }
                if (rippleShouldTrigger(isTouch)) {
                    const
                        {top, left, width} = getDescriptor(x, y),
                        noRipplesActive = Object.keys(this.state.ripples).length === 0,
                        key = rippleMultiple || noRipplesActive ? getNextKey() : this.currentKey,
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
                    this.setState({ripples: {...this.state.ripples, [key]: {active: false, restarting: true, top, left, width, endRipple}}},
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
            renderRipple = (key, className, {active, left, restarting, top, width}) => {
                return (
                    <span key={key} class={style.rippleWrapper || "rippleWrapper"} {...props}>
                <span
                    class={classes(style.ripple, {[style.rippleActive]: active, [style.rippleRestarting]: restarting}, className)}
                    style={{transform: `translate3d(${-width / 2 + left}px, ${-width / 2 + top}px, 0) scale(${restarting ? 0 : 1})`, width, height: width}}
                    ref={node => {if (node) this.rippleNodes[key] = node}}
                />
            </span>
                )
            },
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
            }, [children, Object.entries(ripples).map(([k, v]) => renderRipple(k, rippleClass, v))]
        )
    }
}
