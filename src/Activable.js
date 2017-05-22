import {h, Component} from 'preact'

export default ({delay = 5000} = {}) => ActivableComponent => class extends Component {
    static defaultProps = {delay}

    state = {active: this.props.active, rendered: this.props.active}

    componentWillReceiveProps ({active}) {
        console.log('Activable.componentWillReceiveProps', active)
        const
            activate = () => {
                console.log('Activable.activate')
                if (this.unrenderTimeout) clearTimeout(this.unrenderTimeout)
                this.setState({rendered: true, active: false}, () => {
                    this.activateTimeout = setTimeout(() => this.setState({active: true}), 20)
                })
            },
            deactivate = () => {
                console.log('Activable.deactivate')
                this.setState({rendered: true, active: false}, () => {
                    this.unrenderTimeout = setTimeout(() => {
                        this.setState({rendered: false})
                        this.unrenderTimeout = null
                    }, this.props.delay)
                })
            }
        //debugger
        if (active ^ this.props.active) active ? activate() : deactivate()
    }

    componentWillUnmount () {
        clearTimeout(this.activateTimeout)
        clearTimeout(this.unrenderTimeout)
    }

    render ({delay, ...others}, {active, rendered}) {
        console.log('Activable.render')
        return rendered && <ActivableComponent {...others} active={active}/>
    }
}
