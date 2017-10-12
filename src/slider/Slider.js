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
    }

    // trackC

    resize = e => {
        const {left, width} = this.trackC.getBoundingClientRect()
        this.setState({left, width})
    }

    onClick = e => {
    }

    render ({value, min, max, onChange, class: _class}, {left, width}) {
        const scaled = (value - min) / (max - min)
        return (
            <div class={classes(style.slider, _class)}>
                <div class={style.trackC} ref={node => this.trackC = node}>
                    <div class={style.track} style={{transform: `scaleX(${scaled})`}}/>
                </div>
                <div class={style.thumbC} style={{transform: `translateX(${scaled * width}px)`}}>
                    <div class={style.thumb}/>
                </div>
            </div>
        )
    }
}
