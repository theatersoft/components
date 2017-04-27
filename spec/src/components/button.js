import {h} from 'preact'
import {Button} from '@theatersoft/components'

export default () => (
    <section class="inverse">
        <Button label="Flat" flat/>
        <Button label="Raised" raised/>
        <Button label="Primary" primary/>
        <Button label="Accent" accent/>
        <Button icon="cross" floating/>
        <Button icon="cross" floating primary/>
        <Button icon="cross" floating accent/>
    </section>
)
