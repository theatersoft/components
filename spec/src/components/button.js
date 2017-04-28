import {h} from 'preact'
import {Button, classes} from '@theatersoft/components'

export default ({inverse}) => (
    <section class={classes({inverse})}>
        <Button icon="cross" label="Flat" flat {...{inverse}}/>
        <Button icon="cross" label="Raised" raised {...{inverse}}/>
        <Button label="Primary" primary {...{inverse}}/>
        <Button label="Accent" accent {...{inverse}}/>
        <Button icon="cross" floating {...{inverse}}/>
        <Button floating primary label="3" {...{inverse}}/>
        <Button icon="cross" floating accent mini {...{inverse}}/>
    </section>
)
