import {h} from 'preact'
import {Chart, Row} from '@theatersoft/components'

const randomData = () =>
    Array.from({length: 10}, () => Math.floor(Math.random() * 100))

export default () => (
    <section>
            <Chart
                title="Line Chart"
                type="line"
                data={{
                    labels: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
                    datasets: [
                        {
                            color: 'light-blue',
                            values: randomData()
                        }
                    ]
                }}
                show_dots={false}
                heatline
                region_fill
            />
    </section>
)
