import {h, Component} from 'preact'
import {Button, Snackbar} from '@theatersoft/components'

export default class extends Component {
    render (_, {active}) {
        return (
            <section>
                <Button label="Show Snackbar" raised onClick={this.setState({active: true})}/>
                <Snackbar
                    action="Hide"
                    active={active}
                    timeout={4000}
                    onClick={this.setState({active: false})}
                    onTimeout={this.setState({active: false})}
                    type="warning"
                >
                    Test content
                </Snackbar>
            </section>
        )
    }
}