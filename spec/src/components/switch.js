import {h, Component} from 'preact'
import {Switch} from '@theatersoft/components'

export default class extends Component {
    onChange = (value, e) => {
        this.setState({value})
    }

    render (_, {value}) {
        return (
            <section>
                <Switch checked={value} data-id="Switch.1" onChange={this.onChange}/>
            </section>
        )
    }
}
