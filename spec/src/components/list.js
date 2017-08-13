import {h, Component} from 'preact'
import {List, Subheader, ListItem, NestedList, Switch} from '@theatersoft/components'

export default class extends Component {
    render (_, {sw}) {
        const toggle = () => this.setState({sw: !sw})
        return (
            <section>
                <List>
                    <Subheader label="Subheader"/>
                    <ListItem label="Primary text"/>
                    <ListItem icon="cross" label="Item with left icon"/>
                    <NestedList label="Nested list">
                        <ListItem label="One"/>
                        <ListItem label="Two"/>
                        <ListItem label="Three"/>
                    </NestedList>
                    <NestedList label="Active Nested list" active>
                        <ListItem label="One"/>
                        <ListItem label="Two"/>
                        <ListItem label="Three"/>
                    </NestedList>
                    <ListItem icon="cross" label="Item with icon and child" onClick={toggle}>
                        <Switch checked={sw} onChange={toggle}/>
                    </ListItem>
                </List>
            </section>
        )
    }
}
