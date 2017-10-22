import {h, Component} from 'preact'
import {Ripple, classes} from '../'
import style from './slider.styl'

const RippleDiv = Ripple({centered: false, spread: 2.5, multiple: false})(props =>
    <div {...props}></div>
)

export const Slider = class extends Component {
    static defaultProps = {min: 0, max: 100, step: 1}

    componentDidMount () {
        window.addEventListener('resize', this.resize)
        this.resize()
        this.container = this.base
    }

    componentWillUnmount () {
        window.removeEventListener('resize', this.resize)
        this.container.removeEventListener('pointermove', this.pointerMove)
        this.container.removeEventListener('pointerup', this.pointerUp)
    }

    resize = (e, cb) => {
        const {left, width} = this.trackC.getBoundingClientRect()
        this.setState({left, width}, cb)
    }

    pointerDown = e => {
        console.log('Slider.pointerDown', e)
        e.stopPropagation()
        this.container.addEventListener('pointermove', this.pointerMove)
        this.container.addEventListener('pointerup', this.pointerUp)
        this.resize(undefined, () => {
            this.setState({pressed: true, value: this.value(e.pageX)})
        })
    }

    pointerMove = e => {
        console.log('Slider.pointerMove', e)
        const value = this.value(e.pageX)
        if (value !== this.state.value) this.setState({value})
    }

    pointerUp = e => {
        console.log('Slider.pointerUp', e)
        this.container.removeEventListener('pointermove', this.pointerMove)
        this.container.removeEventListener('pointerup', this.pointerUp)
        this.setState({pressed: false}) // todo released state pending prop update
        if (this.state.value !== this.props.value) this.props.onChange(this.state.value)
    }

    onGesture = e => {
        console.log('Slider.onGesture', e)
    }

    value (x) {
        const
            {left, width} = this.state,
            {max, min, step} = this.props,
            val = ((x - left) / width) * (max - min),
            clamp = v => v < min ? min : v > max ? max : v
        return clamp(Math.round(val / step) * step + min)
    }

    refTrackC = node => this.trackC = node

    render ({value: a, min, max, class: _class, ...props}, {left, width, pressed, value: b}) {
        console.log('render', {pressed, a, b})
        const
            value = pressed ? b : a,
            scaled = (value - min) / (max - min)
        return (
            <RippleDiv class={classes(style.slider, value === min && style.zero, _class)}
                       onPointerDown={this.pointerDown} {...props}>
                <div class={style.trackC} ref={this.refTrackC}>
                    <div class={style.track} style={{transform: `scaleX(${scaled})`}}/>
                </div>
                <div class={style.thumbC} style={{transform: `translateX(${scaled * width}px)`}}>
                    <div class={classes(style.thumb)}/>
                </div>
            </RippleDiv>
        )
    }
}
