import {h, Component} from 'preact'
import {Slider} from '@theatersoft/components'

export default class extends Component {
    state = {value: 25}

    onChange = value => this.setState({value})

    render (_, {value}) {
        return (
            <section>
                <span>{value}</span>
                <Slider value={value} onChange={this.onChange}/>
            </section>
        )
    }
}
