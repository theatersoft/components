import {h, Component} from 'preact'
import {classes} from '../'
import style from './chart.styl'
import {Chart as _Chart} from "frappe-charts/dist/frappe-charts.esm"

export class Chart extends Component {
    componentDidMount () {
        const {
            title,
            data,
            type = 'bar',
            onSelect,
            ...rest
        } = this.props
        this.c = new _Chart(this.chart, {title, data, type, is_navigable: !!onSelect, ...rest})
        if (onSelect) this.c.parent.addEventListener('data-select', onSelect)
    }

    componentWillReceiveProps (props) {
        this.c.update_values(props.data.datasets, props.data.labels)
    }

    ref = node => {this.chart = node}

    render ({class: _class}) {
        return <div class={classes(style.chart, _class)} ref={this.ref}/>
    }
}