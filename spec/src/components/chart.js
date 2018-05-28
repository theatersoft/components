import {h} from 'preact'
import {Chart, Row} from '@theatersoft/components'

export default () => (
    <section>
        <Chart
            title="Line Chart"
            type="line"
            data={{
                labels: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
                datasets: [{
                    color: 'light-blue',
                    values: Array.from({length: 10}, () => Math.floor(Math.random() * 100))
                }]
            }}
        />
    </section>
)
