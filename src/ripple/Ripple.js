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
    ...props}) =>
    ComposedComponent =>
        class extends Component {
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
                if (Object.keys(prevState.ripples).length < Object.keys(this.state.ripples).length)
                    this.addRippleRemoveEventListener(this.currentKey)
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
                    }
                if (rippleShouldTrigger(isTouch)) {
                    const
                        {top, left, width} = getDescriptor(x, y),
                        noRipplesActive = Object.keys(this.state.ripples).length === 0,
                        key = this.props.rippleMultiple || noRipplesActive ? getNextKey() : this.currentKey,
                        endRipple = this.addRippleDeactivateEventListener(isTouch, key),
                        initialState = {active: false, restarting: true, top, left, width, endRipple},
                        runningState = {active: true, restarting: false},
                        ripples = {...this.state.ripples, [key]: initialState}
                    this.setState({ripples}, () => {
                        //if (this.rippleNodes[key]) this.rippleNodes[key].offsetWidth //reflow?
                        this.setState({
                            ripples: {
                                ...this.state.ripples,
                                [key]: Object.assign({}, this.state.ripples[key], runningState)
                            }
                        })
                    })
                }
            }

            addRippleRemoveEventListener (rippleKey) {
                const
                    rippleNode = this.rippleNodes[rippleKey],
                    onOpacityEnd = e => {
                        if (e.propertyName === 'opacity') {
                            if (this.props.onRippleEnded) this.props.onRippleEnded(e)
                            rippleNode.removeEventListener('transitionend', onOpacityEnd)
                            delete this.rippleNodes[rippleKey]
                            const {[rippleKey]: _, ...ripples} = this.state.ripples
                            this.setState({ripples})
                        }
                    }
                rippleNode.addEventListener('transitionend', onOpacityEnd)
            }

            addRippleDeactivateEventListener (isTouch, rippleKey) {
                const
                    eventType = isTouch ? 'touchend' : 'mouseup',
                    endRipple = () => {
                        document.removeEventListener(eventType, endRipple)
                        this.setState({
                            ripples: {
                                ...this.state.ripples,
                                [rippleKey]: Object.assign({}, this.state.ripples[rippleKey], {active: false})
                            }
                        })
                    }
                document.addEventListener(eventType, endRipple)
                return endRipple
            }

            renderRipple (key, className, {active, left, restarting, top, width}) {
                const
                    transform = `translate3d(${-width / 2 + left}px, ${-width / 2 + top}px, 0) scale(${restarting ? 0 : 1})`,
                    _style = {transform, width, height: width},
                    _class = classes(style.ripple, {
                        [style.rippleActive]: active,
                        [style.rippleRestarting]: restarting
                    }, className)
                console.log('renderRipple', key, _class, _style, this.rippleNodes[key])
                return (
                    <span key={key} class={style.rippleWrapper} {...props}>
                        <span class={_class} ref={node => {if (node) this.rippleNodes[key] = node}} style={_style}/>
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
                    children: doRipple ? children.concat(Object.entries(ripples).map(([k, v]) => this.renderRipple(k, rippleClass, v))) : children,
                    disabled,
                    ...other
                })
            }
        }
