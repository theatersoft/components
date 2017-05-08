import {h, Component} from 'preact'
import {List, ListItem, Switch} from '@theatersoft/components'

export default class extends Component {
    render () {
        return (
            <section>
                <List>
                    <ListItem label="Primary text"/>
                    <ListItem icon="cross" label="Item with left icon"/>
                    <ListItem icon="cross" label="Item with icon and child">
                        <Switch checked={this.state.sw} onChange={v => this.setState({sw: v})}/>
                    </ListItem>
                </List>
            </section>
        )
    }
}
