import {h, Component} from 'preact'
import {classes, Activable, Button} from '../'
import style from './overlay.styl'

export default class extends Component {
    //componentDidMount () {
    //    const {active} = this.props
    //    if (active) document.body.style.overflow = 'hidden'
    //}
    //
    //componentWillUpdate ({active}) {
    //    if (active ^ this.props.active) document.body.style.overflow = active ? 'hidden' : ''
    //}
    //
    //componentWillUnmount () {
    //    const {active} = this.props
    //    if (active) document.body.style.overflow = ''
    //}

    onClick = event => {
        event.preventDefault()
        event.stopPropagation()
        if (this.props.onClick) this.props.onClick(event)
    }

    render (props) {
        const {active, class: _class, ...other} = props
        console.log('Overlay.render', props)
        return (
            <div {...other}
                onClick={this.onClick}
                class={classes(style.overlay, {[style.active]: active}, _class)}/>
        )
    }
}
