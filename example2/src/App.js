import { h, Component } from 'preact'
import {Shell} from 'md-components'
import {Route} from 'react-router-dom'

import './App.css';

import NavigationRoute from './navigationRoute'
import ButtonRoute from './buttonRoute'

class App extends Component {
  render() {
    return (
      <Shell
          links={[
                {text: 'Navigation', link: '/navigation'},
                {text: 'Button', link: '/button'},

          ]}
      >
          <Route path='/navigation' component={NavigationRoute} />
          <Route path='/button' component={ButtonRoute} />
          </Shell>
    );
  }
}

export default App;
