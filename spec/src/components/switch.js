import {h, Component} from 'preact'
import {Switch} from '@theatersoft/components'

export default class extends Component {
    onChange = (value, e) => {
        console.log(e, e.currentTarget.dataset.id)
        this.setState({sw: value})
    }

    render (_, {sw}) {
        return (
            <section>
                <Switch
                    checked={sw}
                    label="Switch"
                    data-id="Switch.1"
                    onChange={this.onChange}
                />
            </section>
        )
    }
}
