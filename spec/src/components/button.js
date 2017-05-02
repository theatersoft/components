import {h} from 'preact'
import {Button, classes} from '@theatersoft/components'

export default ({light}) => {
    const inverse = !light
    return <section class={classes({light})}>
        <Button icon="cross" label="Flat" flat {...{inverse}}/>
        <Button label="Flat" primary {...{inverse}}/>
        <Button label="Flat" accent {...{inverse}}/>
        <Button icon="cross" label="Raised" raised {...{inverse}}/>
        <Button icon="cross" label="Primary" raised primary {...{inverse}}/>
        <Button label="Accent" raised accent {...{inverse}}/>
        <Button icon="cross" floating {...{inverse}}/>
        <Button label="8" floating primary mini {...{inverse}}/>
        <Button icon="cross" floating accent mini {...{inverse}}/>
    </section>
}
