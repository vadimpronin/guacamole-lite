import Guacamole from 'guacamole-common-js';
import React from 'react';
import crypto from "crypto";

// DO NOT keep this in your frontend application!
// This is just an example.
// See "Security Considerations" in the docs/advanced-configuration.md
const CIPHER = 'aes-256-cbc';
const SECRET_KEY = 'MySuperSecretKeyForParamsToken12';
const tokenObject = {
  connection: {
    type: "rdp",
    settings: {
      "hostname": "10.0.0.12",
      "username": "Administrator",
      "password": "pAsSwOrD",
      "enable-drive": true,
      "create-drive-path": true,
      "security": "any",
      "ignore-cert": true,
      "enable-wallpaper": false
    }
  }
};

// DO NOT do this in your frontend application!
// This is just an example.
// See "Security Considerations" in the docs/advanced-configuration.md
// This is just an example
function encryptToken(value) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(CIPHER, Buffer.from(SECRET_KEY), iv);

  let encrypted = cipher.update(JSON.stringify(value), 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const data = {
    iv: iv.toString('base64'),
    value: encrypted
  };

  const json = JSON.stringify(data);
  return Buffer.from(json).toString('base64');
}


class GuacamoleStage extends React.Component {
  constructor(props) {
    super(props);
    this.myRef = React.createRef();

    this.token = encryptToken(tokenObject);

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

