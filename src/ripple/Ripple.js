import {h, Component} from 'preact'
import style from './ripple.styl'
import {classes} from '../classes'

const
    mousePosition = event => ([
        event.pageX - (window.scrollX || window.pageXOffset),
        event.pageY - (window.scrollY || window.pageYOffset)
    ]),
    touchPosition = event => ([
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
                    console.log(e)
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
            console.log('added transitionend')
        }
        console.log('componentDidUpdate')
        if (Object.keys(prevState.ripples).length < Object.keys(this.state.ripples).length)
            addRippleRemoveEventListener(this.currentKey)
    }

    componentWillUnmount () {Object.values(this.state.ripples).forEach(v => v.endRipple())}

    animateRipple (x, y, isTouch) {
        const
            getNextKey = () => (this.currentKey = `ripple${++this.currentCount}`),
            rippleShouldTrigger = isTouch => {
                const shouldStart = isTouch || !this.touchCache
                this.touchCache = isTouch
                return shouldStart
            },
            getDescriptor = (x, y) => {
                const
                    {left, top, height, width} = this.base.getBoundingClientRect(),
                    {rippleCentered: centered, rippleSpread: spread} = this.props
                return {
                    left: centered ? 0 : x - left - width / 2,
                    top: centered ? 0 : y - top - height / 2,
                    width: width * spread
                }
            },
            addEndRipple = key => {
                const
                    eventType = isTouch ? 'touchend' : 'mouseup',
                    endRipple = () => {
                        document.removeEventListener(eventType, endRipple)
                        console.log('endRipple setState', this.state.ripples)
                        this.setState({
                            ripples: {
                                ...this.state.ripples,
                                [key]: {...this.state.ripples[key], active: false}
                            }
                        }, () => console.log('endRipple setState cb', this.state.ripples))
                    }
                document.addEventListener(eventType, endRipple)
                return endRipple
            }
        if (rippleShouldTrigger(isTouch)) {
            const
                {top, left, width} = getDescriptor(x, y),
                noRipplesActive = Object.keys(this.state.ripples).length === 0,
                key = this.props.rippleMultiple || noRipplesActive ? getNextKey() : this.currentKey,
                endRipple = addEndRipple(key)
            console.log('restarting')
            this.setState({ripples: {...this.state.ripples, [key]: {active: false, restarting: true, top, left, width, endRipple}}},
                () => {
                    if (this.rippleNodes[key]) this.rippleNodes[key].offsetWidth
                    console.log('restarting setState cb', this.state.ripples)
                    console.log('setState active')
                    this.setState({
                        ripples: {
                            ...this.state.ripples,
                            [key]: {...this.state.ripples[key], active: true, restarting: false}
                        }
                    }, () => console.log('setState active cb', this.state.ripples))
                }
            )
        }
    }

    renderRipple (key, className, {active, left, restarting, top, width}) {
        return (
            <span key={key} class={style.rippleWrapper || "rippleWrapper"} {...props}>
                <span
                    class={classes(style.ripple, {[style.rippleActive]: active, [style.rippleRestarting]: restarting}, className)}
                    style={{transform: `translate3d(${-width / 2 + left}px, ${-width / 2 + top}px, 0) scale(${restarting ? 0 : 1})`, width, height: width}}
                    ref={node => {if (node) this.rippleNodes[key] = node}}
                />
            </span>
        )
    }

    render ({ripple, rippleClass, disabled, onRippleEnded, rippleCentered, rippleMultiple, rippleSpread, children, ...other}, {ripples}) {
        const
            doRipple = !disabled && ripple,
            onMouseDown = e => {
                if (this.props.onMouseDown) this.props.onMouseDown(e)
                if (doRipple) this.animateRipple(...mousePosition(e), false)
            },
            onTouchStart = e => {
                if (this.props.onTouchStart) this.props.onTouchStart(e)
                if (doRipple) this.animateRipple(...touchPosition(e), true)
            }
        return h(ComposedComponent, {
                ...doRipple && {onMouseDown, onTouchStart},
                disabled,
                ...other
            }, [children, Object.entries(ripples).map(([k, v]) => this.renderRipple(k, rippleClass, v))]
        )
    }
}
