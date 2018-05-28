import {h, Component} from 'preact'
import {classes} from '../'
import style from './chart.styl'
import {Chart as _Chart} from "frappe-charts/dist/frappe-charts.esm"

export class Chart extends Component {
    componentDidMount () {
        const {
            title,
            data,
            type = 'line',
            onSelect,
            lineOptions = {regionFill: 1, hideDots: 0, heatline: 0},
            ...rest
        } = this.props
        this.chart = new _Chart(this.parent, {
            title, data, type, is_navigable: !!onSelect, lineOptions,
            ...rest
        })
        if (onSelect) this.chart.parent.addEventListener('data-select', onSelect)
    }

    componentWillReceiveProps (props) {
        this.chart.update_values(props.data.datasets, props.data.labels)
    }

    ref = node => {this.parent = node}

    render ({class: _class}) {
        return <div class={classes(style.chart, _class)} ref={this.ref}/>
    }
}