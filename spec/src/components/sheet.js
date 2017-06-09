import {h, Component} from 'preact'
import {Button, Sheet} from '@theatersoft/components'

export default class extends Component {
    state = {active: false, next: false}

    render (_, {active, type, next}) {
        return (
            <section>
                <p>sheet</p>
                <nav>
                    <Button label="Left" raised primary onClick={() => this.setState({active: true, type: 'left'})}/>
                    <Button label="Right" raised primary onClick={() => this.setState({active: true, type: 'right'})}/>
                    <Button label="Top" raised primary onClick={() => this.setState({active: true, type: 'top'})}/>
                    <Button label="Bottom" raised primary
                            onClick={() => this.setState({active: true, type: 'bottom'})}/>
                </nav>
                <Sheet active={active} type={type} onClick={() => this.setState({active: false, next: false})}>
                    {next ? <p>next content</p> : [
                        <p>content</p>,
                        < Button label="Next" raised primary
                                 onClick={() => this.setState({active: true, type: 'left', next: true})}/>
                    ]}
                </Sheet>
            </section>
        )
    }
}