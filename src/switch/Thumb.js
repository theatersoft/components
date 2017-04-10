import {h, Component} from 'preact'

const factory = (ripple) => {
  const Thumb = ({onMouseDown, theme, ...other}) => (
    <span class="thumb" onMouseDown={onMouseDown} {...other} />
  )

  return ripple(Thumb)
}

export default factory
