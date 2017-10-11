import {h, Component} from 'preact'
import {Slider} from '@theatersoft/components'

export default class extends Component {
    onChange = value => {
        this.setState({value})
    }

    render (_, {value}) {
        return (
            <section>
                <Slider
                    value={value}
                    onChange={this.onChange}
                />
            </section>
        )
    }
}
