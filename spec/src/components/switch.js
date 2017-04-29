import {h, Component} from 'preact'
import {Switch} from '@theatersoft/components'

export default class extends Component {
    state = {
        sw: false
    }

    onChange = value => {
        console.log('Switch.onChange', value)
        this.setState({sw: value})
    }

    render (p, {sw}) {
        console.log('Switch.render', p, this.state, sw)
        return (
            <section>
                <Switch
                    checked={sw}
                    label="Switch"
                    onChange={this.onChange}
                />
            </section>
        )
    }
}
