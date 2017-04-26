import {h, Component} from 'preact'
import './icon.styl'

export const Icon = ({icon, cb}) =>
    <div class="iconpad" onClick={e => {e.stopPropagation(); cb()}}>
        <svg class="icon" id={`icon-${icon}`}>
            <use href={`#svg-${icon}`}/>
        </svg>
    </div>
