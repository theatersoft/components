import './resize'
import {h, Component} from 'preact'
import {
    //Icon, mixinFocusable,
    Switch
} from '@theatersoft/components'
import './App.styl'
import '@theatersoft/components/components.css'

class Switches extends Component {
    state = {
        sw: false
    }

    onChange = value => {
        console.log('Switches.onChange', value)
        this.setState({sw: value})
    }

    render (p, {sw}) {
        console.log('Switches.render', p, this.state, sw)
        return (
            <Switch
                checked={sw}
                label="switch"
                onChange={this.onChange}
            />
        )
    }
}

export default class App extends Component {
    render () {
        return (
            <div>
                <Switches/>
            </div>
        )
    }
}


