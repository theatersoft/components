import {h, Component} from 'preact'
import {Button} from '@theatersoft/components'

export default class extends Component {
    onChange = value => {
        console.log('Button.onChange', value)
    }

    render (p) {
        console.log('Button.render', p, this.state)
        return (
            <section>
                <Button
                    label="button"
                    onChange={this.onChange}
                />
            </section>
        )
    }
}
