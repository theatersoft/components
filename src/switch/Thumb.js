import {h, Component} from 'preact'
import style from './index.styl'

const factory = (ripple) => {
  const Thumb = ({onMouseDown, theme, ...other}) => (
    <span class={style.thumb} onMouseDown={onMouseDown} {...other} />
  )

  return ripple(Thumb)
}

export default factory
