import Guacamole from 'guacamole-common-js';
import React from 'react';
import encrypt from './encrypt.js';

class GuacamoleStage extends React.Component {
  constructor(props) {
    super(props);
    this.myRef = React.createRef();

    this.token = encrypt({
      connection: {
        type: 'rdp',
        settings: {
          hostname: '10.10.10.10', // Replace with IP
          username: 'Administrator',
          password: 'Password',
          'enable-drive': true,
          'create-drive-path': true,
          security: 'any',
          'ignore-cert': true,
          'enable-wallpaper': false,
        },
      },
    });

    this.tunnel = new Guacamole.WebSocketTunnel('ws://localhost:8080/');
    this.client = new Guacamole.Client(this.tunnel);
  }

  componentDidMount() {
    this.myRef.current.appendChild(this.client.getDisplay().getElement());
    this.client.connect('token='+this.token);
  }

  render() {
    return <div ref={this.myRef} />;
  }
}

  export default GuacamoleStage

