import {h, Component} from 'preact'
import {classes} from '../'
import style from './slider.styl'

export const Slider = class extends Component {
    static defaultProps = {min: 0, max: 100}

    componentDidMount() {
        window.addEventListener('resize', this.resize)
        this.resize()
    }

    // trackC

    resize = e => {
        const {left, right} = this.trackC.getBoundingClientRect()
        console.log(this.trackC.getBoundingClientRect())
    }

    onClick = e => {
    }

    render ({class: _class, value, min, max, onChange, ...props}) {
        const scaled = (value - min) / (max - min)
        return (
            <div class={style.slider}>
                <div class={style.trackC} ref={node => this.trackC = node}>
                    <div class={style.track} style={`transform: scaleX(${scaled});`}/>
                </div>
                <div class={style.thumbC} style="transform: translateX(390px);">
                    <svg class={style.thumb}>
                        <circle cx="10.5" cy="10.5" r="7.875"/>
                    </svg>
                </div>
            </div>
        )
    }
}
