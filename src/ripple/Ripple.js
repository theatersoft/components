import {h, Component} from 'preact'
import style from './ripple.styl'
import {classes} from '../classes'

import events from '../utils/events'
import prefixer from '../utils/prefixer'

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
                    this.addRippleRemoveEventListener(this.getLastKey())
            }

            componentWillUnmount () {Object.values(this.state.ripples).forEach(v => v.endRipple())}

            getDescriptor (x, y) {
                const
                    {left, top, height, width} = this.base.getBoundingClientRect(),
                    {rippleCentered: centered, rippleSpread: spread} = this.props
                return {
                    left: centered ? 0 : x - left - width / 2,
                    top: centered ? 0 : y - top - height / 2,
                    width: width * spread
                }
            }

            getNextKey () {return `ripple${++this.currentCount}`}

            getLastKey () {return `ripple${this.currentCount}`}

            rippleShouldTrigger (isTouch) {
                const shouldStart = isTouch || !this.touchCache
                this.touchCache = isTouch
                return shouldStart
            }

            animateRipple (x, y, isTouch) {
                if (this.rippleShouldTrigger(isTouch)) {
                    const
                        {top, left, width} = this.getDescriptor(x, y),
                        noRipplesActive = Object.keys(this.state.ripples).length === 0,
                        key = (this.props.rippleMultiple || noRipplesActive) ? this.getNextKey() : this.getLastKey(),
                        endRipple = this.addRippleDeactivateEventListener(isTouch, key),
                        initialState = {active: false, restarting: true, top, left, width, endRipple},
                        runningState = {active: true, restarting: false},
                        ripples = {...this.state.ripples, [key]: initialState}
                    this.setState({ripples}, () => {
                        if (this.rippleNodes[key]) this.rippleNodes[key].offsetWidth //reflow?
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
                const self = this // TODO
                const rippleNode = this.rippleNodes[rippleKey]
                events.addEventListenerOnTransitionEnded(rippleNode, function onOpacityEnd (e) {
                    if (e.propertyName === 'opacity') {
                        if (self.props.onRippleEnded) self.props.onRippleEnded(e)
                        events.removeEventListenerOnTransitionEnded(self.rippleNodes[rippleKey], onOpacityEnd)
// TODO
                        delete self.rippleNodes[rippleKey]
                        const {[rippleKey]: _, ...ripples} = self.state.ripples
                        self.setState({ripples})
                    }
                })
            }

            addRippleDeactivateEventListener (isTouch, rippleKey) {
                const
                    eventType = isTouch ? 'touchend' : 'mouseup',
                    endRipple = this.createRippleDeactivateCallback(eventType, rippleKey)
                document.addEventListener(eventType, endRipple)
                return endRipple
            }

            createRippleDeactivateCallback (eventType, rippleKey) {
                const self = this; //TODO
                return function endRipple () {
                    document.removeEventListener(eventType, endRipple);
                    self.setState({
                        ripples: {
                            ...self.state.ripples,
                            [rippleKey]: Object.assign({}, self.state.ripples[rippleKey], {active: false}), //TODO
                        }
                    });
                };
            }

            doRipple = () => (!this.props.disabled && this.props.ripple)

            handleMouseDown = (event) => {
                if (this.props.onMouseDown) this.props.onMouseDown(event)
                if (this.doRipple()) this.animateRipple(...events.getMousePosition(event), false)
            };

            handleTouchStart = (event) => {
                if (this.props.onTouchStart) this.props.onTouchStart(event);
                if (this.doRipple()) this.animateRipple(...events.getTouchPosition(event), true)
            };

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

            render ({ripple, rippleClass, onRippleEnded, rippleCentered, rippleMultiple, rippleSpread, children, ...other}, {ripples}) {
                return <ComposedComponent {...{
                    ...ripple && {onMouseDown: this.handleMouseDown, onTouchStart: this.handleTouchStart},
                    children: ripple ? children.concat(Object.entries(ripples).map(([k, v]) => this.renderRipple(k, rippleClass, v))) : children,
                    ...other
                }}/>
            }
        }
