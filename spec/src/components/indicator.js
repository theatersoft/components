import {h} from 'preact'
import {Indicator} from '@theatersoft/components'

export default () => (
    <section>
        <Indicator/>
        <Indicator normal/>
        <Indicator warning/>
        <Indicator error/>
    </section>
)
