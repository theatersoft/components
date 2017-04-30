import {h, Component} from 'preact'

export default ({
    centered: defaultCentered = false,
    class: defaultClass = '',
    multiple: defaultMultiple = true,
    spread: defaultSpread = 2,
    ...props}) =>
    ComposedComponent =>
        class extends Component {
            static defaultProps = {
                disabled: false,
                ripple: true,
                rippleCentered: defaultCentered,
                rippleClass: defaultClass,
                rippleMultiple: defaultMultiple,
                rippleSpread: defaultSpread
            }

            state = {
                ripples: {}
            }

            render (props) {
                return <ComposedComponent {...props} />
            }
        }
