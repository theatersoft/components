import {h, Component} from 'preact'
import {Button, Sheet} from '@theatersoft/components'

export default class extends Component {
    state = {active: false, index: 0}

    next = () => this.setState({index: this.state.index + 1})

    back = () => this.setState({index: this.state.index - 1})

    render (_, {active, type, index}) {
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
                <Sheet
                    active={active}
                    type={type}
                    index={index}
                    onClick={() => this.setState({active: false})}
                >
                    <div>
                        <p>First content</p>
                        < Button label="Next" raised primary onClick={this.next}/>
                    </div>
                    <div>
                        <p>Second content</p>
                        < Button label="Back" raised primary onClick={this.back}/>
                        < Button label="Next" raised primary onClick={this.next}/>
                    </div>
                    <div>
                        <p>Third content</p>
                        < Button label="Back" raised primary onClick={this.back}/>
                    </div>
                </Sheet>
            </section>
        )
    }
}