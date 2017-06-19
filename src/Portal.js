import {h, Component, render} from 'preact'

const Null = () => null

class PortalProvider extends Component {
    getChildContext () {
        return this.props.context
    }

    render () {
        return <div class={this.props.class}>{this.props.children}</div>
    }
}

export class Portal extends Component {
    componentDidMount () {this.renderPortal()}

    componentDidUpdate () {this.renderPortal()}

    componentWillUnmount () {this.unrenderPortal()}

    renderPortal () {
        if (this.props.children)
            this.portalNode = render(h(PortalProvider, {context: this.context, ...this.props}, this.props.children), this.portalHostNode, this.portalNode)
        else
            this.unrenderPortal()
    }

    unrenderPortal () {
        if (this.portalNode) {
            render(<Null/>, this.portalHostNode, this.portalNode)
            this.portalNode = null
        }
    }

    render () {
        this.portalHostNode = document.getElementById('ui')
    }
}
