import {h, Component} from 'preact'
import {Switch} from '@theatersoft/components'

export default class extends Component {
    onChange = (value, e) => {
        console.log(e, e.currentTarget.dataset.id)
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
