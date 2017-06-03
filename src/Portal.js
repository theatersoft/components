import {h, Component, render} from 'preact'

const Null = () => null

export default class extends Component {
    componentDidMount () {this.renderPortal()}

    componentDidUpdate () {this.renderPortal()}

    componentWillUnmount () {this.unrenderPortal()}

    renderPortal () {
        const portal = this.props.children && <div class={this.props.class}>{this.props.children}</div>
        if (portal) {
            this.portalNode = render(portal, this.portalHostNode, this.portalNode)
        } else {
            this.unrenderPortal()
        }
    }

    unrenderPortal () {
        if (this.portalNode) {
            render(<Null/>, this.portalHostNode, this.portalNode)
            this.portalNode = null
        }
    }

    render () {
        this.portalHostNode = document.getElementById('ui')
        return null
    }
}
