import {h, Component} from 'preact'
import {classes} from '../'
import style from './slider.styl'

export const Slider = class extends Component {
    static defaultProps = {min: 0, max: 100, step: 1}

    componentDidMount () {
        window.addEventListener('resize', this.resize)
        this.resize()
    }

    componentWillUnmount () {
        window.removeEventListener('resize', this.resize)
        document.removeEventListener('mousemove', this.mouseMove)
        document.removeEventListener('mouseup', this.mouseUp)
    }

    resize = (e, cb) => {
        const {left, width} = this.trackC.getBoundingClientRect()
        this.setState({left, width}, cb)
    }

    mouseDown = e => {
        document.addEventListener('mousemove', this.mouseMove)
        document.addEventListener('mouseup', this.mouseUp)
        this.start(e.pageX)
    }

    mouseMove = e => {
        this.move(e.pageX)
    }

    mouseUp = e => {
        document.removeEventListener('mousemove', this.mouseMove)
        document.removeEventListener('mouseup', this.mouseUp)
        this.end()
    }

    start (x) {
        this.resize(undefined, () => {
            this.setState({pressed: true, value: this.value(x)})
        })
    }

    move (x) {
        const value = this.value(x)
        if (value !== this.state.value) this.setState({value: this.value(x)})
    }

    end () {
        this.setState({pressed: false}) // todo released state pending prop update
        if (this.state.value !== this.props.value) this.props.onChange(this.state.value)
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

    render ({value: a, min, max, class: _class}, {left, width, pressed, value: b}) {
        const
            value = pressed ? b : a,
            scaled = (value - min) / (max - min)
        return (
            <div class={classes(style.slider, _class)} onMouseDown={this.mouseDown}>
                <div class={style.trackC} ref={this.refTrackC}>
                    <div class={style.track} style={{transform: `scaleX(${scaled})`}}/>
                </div>
                <div class={style.thumbC} style={{transform: `translateX(${scaled * width}px)`}}>
                    <div class={classes(style.thumb, value === min && style.zero)}/>
                </div>
            </div>
        )
    }
}
