import {h, Component} from 'preact'
import {Button, Sheet} from '@theatersoft/components'

export default class extends Component {
    state = {active: false}

    render (_, {active, type}) {
        return (
            <section>
                <p>sheet</p>
                <nav>
                <Button label="Left" raised primary onClick={() => this.setState({active: true, type: 'left'})}/>
                <Button label="Right" raised primary onClick={() => this.setState({active: true, type: 'right'})}/>
                <Button label="Top" raised primary onClick={() => this.setState({active: true, type: 'top'})}/>
                <Button label="Bottom" raised primary onClick={() => this.setState({active: true, type: 'bottom'})}/>
                </nav>
                <Sheet active={active} type={type} onClick={() => this.setState({active: false})}>
                    <p>content</p>
                </Sheet>
            </section>
        )
    }
}