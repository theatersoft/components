import {h, Component} from 'preact'
import {classes} from '../'
import style from './slider.styl'

export const Slider = class extends Component {
    onClick = e => {
    }

    render ({class: _class, label, checked = false, disabled = false, onChange, ...props}) {
        return (
            <div class="slider">
                <div class="track-container">
                    <div class="track" style="transform: scaleX(0.5);"></div>
                </div>
                <div class="thumb-container" style="transform: translateX(300px) translateX(-50%);">
                    <svg class="thumb" width="21" height="21">
                        <circle cx="10.5" cy="10.5" r="7.875"></circle>
                    </svg>
                </div>
            </div>
        )
    }
}
