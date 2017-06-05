import {h, Component} from 'preact'
import {Button, Sheet} from '@theatersoft/components'

export default class extends Component {
    render (_, {active}) {
        return (
            <section>
                <p>sheet</p>
                <nav>
                <Button label="Left" raised primary onClick={() => this.setState({active: true, type: 'left'})}/>
                <Button label="Right" raised primary onClick={() => this.setState({active: true, type: 'right'})}/>
                <Button label="Top" raised primary onClick={() => this.setState({active: true, type: 'top'})}/>
                <Button label="Bottom" raised primary onClick={() => this.setState({active: true, type: 'bottom'})}/>
                </nav>
                <Sheet active={active} type={type} onOverlayClick={() => this.setState({active: false})}>
                    <p>content</p>
                </Sheet>
            </section>
        )
    }
}