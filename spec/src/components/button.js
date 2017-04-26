import {h} from 'preact'
import {Button} from '@theatersoft/components'

export default () => (
    <section>
        <Button label="Flat" flat/>
        <Button label="Raised" raised/>
        <Button label="Primary" primary/>
        <Button label="Accent" accent/>
        <Button icon="add" floating/>
        <Button icon="add" floating primary/>
        <Button icon="add" floating accent/>
    </section>
)
