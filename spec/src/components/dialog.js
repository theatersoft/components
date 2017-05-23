import {h, Component} from 'preact'
import {Button, Dialog} from '@theatersoft/components'

export default class extends Component {
    actions = [
        {label: 'cancel', primary: true},
        {label: 'next', primary: true}
    ]

    render (_, {active}) {
        return (
            <section>
                <Button label="Show dialog" raised primary onClick={() => this.setState({active: true})}/>
                <Dialog
                    actions={this.actions}
                    active={active}
                    type={this.state.type}
                    title="Title"
                    onOverlayClick={() => this.setState({active: false})}
                >
                    <p>content</p>
                </Dialog>
            </section>
        )
    }
}