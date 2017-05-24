import {h, Component} from 'preact'
import {Button, Snackbar} from '@theatersoft/components'

export default class extends Component {
    activate = () => this.setState({active: true})

    deactivate = () => this.setState({active: false})

    render (_, {active}) {
        return (
            <section>
                <Button label="Show Snackbar" raised onClick={this.activate}/>
                <Snackbar
                    action="Hide"
                    active={active}
                    timeout={4000}
                    onClick={this.deactivate}
                    onTimeout={this.deactivate}
                    type="warning"
                >
                    Test content
                </Snackbar>
            </section>
        )
    }
}