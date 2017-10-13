import {h, Component} from 'preact'
import {classes} from '../'
import style from './slider.styl'

export const Slider = class extends Component {
    static defaultProps = {min: 0, max: 100}

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
            this.setState({pressed: true})
            this.props.onChange(this.value(x))
        })
    }

    move (x) {
        const value = this.value(x)
        if (value !== this.props.value) this.props.onChange(value)
    }

    end () {
        this.setState({pressed: false})
    }

    value (x) {
        const
            {left, width} = this.state,
            {max, min, step} = this.props,
            val = ((x - left) / width) * (max - min) // TODO step
        return val + min
    }

    refTrackC = node => this.trackC = node

    render ({value, min, max, onChange, class: _class}, {left, width}) {
        const
            scaled = (value - min) / (max - min)
        return (
            <div class={classes(style.slider, _class)}>
                <div class={style.trackC} ref={this.refTrackC}>
                    <div class={style.track} style={{transform: `scaleX(${scaled})`}}/>
                </div>
                <div class={style.thumbC}
                     style={{transform: `translateX(${scaled * width}px)`}}
                     onMouseDown={this.mouseDown}>
                    <div class={style.thumb}/>
                </div>
            </div>
        )
    }
}
