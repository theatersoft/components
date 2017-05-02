import {h, Component} from 'preact'
import {Switch} from '@theatersoft/components'

export default class extends Component {
    render (p, {sw}) {
        return (
            <section>
                <Switch
                    checked={sw}
                    label="Switch"
                    onChange={value => this.setState({sw: value})}
                />
            </section>
        )
    }
}
