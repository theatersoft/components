import {h, Component} from 'preact'

export const Activable = ({delay = 500} = {}) => ActivableComponent => class extends Component {
    static defaultProps = {delay}

    state = {active: this.props.active, rendered: this.props.active}

    componentWillReceiveProps ({active}) {
        const
            activate = () => {
                if (this.unrenderTimeout) clearTimeout(this.unrenderTimeout)
                this.setState({rendered: true, active: false}, () => {
                    this.activateTimeout = setTimeout(() => this.setState({active: true}), 20)
                })
            },
            deactivate = () => {
                this.setState({rendered: true, active: false}, () => {
                    this.unrenderTimeout = setTimeout(() => {
                        this.setState({rendered: false})
                        this.unrenderTimeout = null
                    }, this.props.delay)
                })
            }
        if (active !== this.props.active) active ? activate() : deactivate()
    }

    componentWillUnmount () {
        clearTimeout(this.activateTimeout)
        clearTimeout(this.unrenderTimeout)
    }

    render ({delay, ...others}, {active, rendered}) {
        return rendered ? <ActivableComponent {...others} active={active}/> : null
    }
}
