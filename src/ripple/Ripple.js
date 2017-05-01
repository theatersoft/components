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

            state = {
                ripples: {}
            }

            componentDidUpdate (prevProps, prevState) {
                if (Object.keys(prevState.ripples).length < Object.keys(this.state.ripples).length)
                    this.addRippleRemoveEventListener(this.getLastKey())
            }

            componentWillUnmount () {
                Object.values(this.state.ripples).forEach(v => v.endRipple())
            }

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

            getNextKey () {
                this.currentCount = (this.currentCount || 0) + 1
                return `ripple${this.currentCount}`
            }

            getLastKey () {
                return `ripple${this.currentCount}`
            }

            rippleNodes = {}

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
                if (this.props.onMouseDown) this.props.onMouseDown(event);
                if (this.doRipple()) {
                    const { x, y } = events.getMousePosition(event);
                    this.animateRipple(x, y, false);
                }
            };

            handleTouchStart = (event) => {
                if (this.props.onTouchStart) this.props.onTouchStart(event);
                if (this.doRipple()) {
                    const { x, y } = events.getTouchPosition(event);
                    this.animateRipple(x, y, true);
                }
            };

            renderRipple (key, className, {active, left, restarting, top, width}) {
                const
                    transform = `translate3d(${-width / 2 + left}rem, ${-width / 2 + top}rem, 0) scale(${restarting ? 0 : 1})`,
                    _transform = prefixer({transform}, {width, height: width}),
                    _class = classes(style.ripple, {
                        [style.rippleActive]: active,
                        [style.rippleRestarting]: restarting,
                        [key]: true //REMOVE
                    }, className)

                console.log('renderRipple', key, _transform, _class)

                return (
                    <span key={key} class={style.rippleWrapper} {...props}>
                        <span
                            class={_class}
                            ref={node => {if (node) this.rippleNodes[key] = node}}
                            style={_transform}
                        />
                    </span>
                )
            }


            render (props, {ripples}) {
                const {
                    ripple, rippleClass,
                    onRippleEnded, rippleCentered, rippleMultiple, rippleSpread,
                    children, ...other } = props
                console.log('render')
                return <ComposedComponent {...{
                    ...ripple && {onMouseDown: this.handleMouseDown, onTouchStart: this.handleTouchStart},
                    children: ripple ? children.concat(Object.entries(ripples).map(([k, v]) => this.renderRipple(k, rippleClass, v))) : children,
                    ...other
                }}/>
            }
        }
