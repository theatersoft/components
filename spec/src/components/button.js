import {h} from 'preact'
import {Button, classes} from '@theatersoft/components'

export default ({inverse}) => (
    <section class={classes({inverse})}>
        <Button icon="cross" label="Flat" flat {...{inverse}}/>
        <Button icon="cross" label="Raised" raised/>
        <Button label="Primary" primary/>
        <Button label="Accent" accent/>
        <Button icon="cross" floating/>
        <Button icon="cross" floating primary/>
        <Button icon="cross" floating accent/>
    </section>
)
