import {h, Component} from 'preact'
import './icon.styl'

export const Icon = ({icon, cb}) =>
    <div class="icon" onClick={e => {e.stopPropagation(); cb()}}>
        <svg id={`icon-${icon}`}>
            <use href={`#svg-${icon}`}/>
        </svg>
    </div>
