async function initGuacamole(token) {
  /* ------------------------ initialise Guacamole ---------------------- */
  const tunnel = new Guacamole.WebSocketTunnel(`ws://${location.hostname}:9091/`);
  const client = new Guacamole.Client(tunnel);

  /* Add the remote display to the page */
  const displayDiv = document.getElementById("display");
  displayDiv.appendChild(client.getDisplay().getElement());

  /* Basic error handler */
  client.onerror = e => console.error(e);

  /* Handle clipboard data from the server */
  client.onclipboard = (stream, mimetype) => {
    let data = '';
    const reader = new Guacamole.StringReader(stream);
    reader.ontext = text => data += text;
    reader.onend = () => {
      console.log("Clipboard data received:", data);
      // Update the hidden textarea and trigger copy
      const textarea = document.getElementById('clipboard-textarea');
      if (textarea) {
        textarea.value = data;
        textarea.select();
        try {
          const successful = document.execCommand('copy');
          const msg = successful ? 'successful' : 'unsuccessful';
          console.log('Copying text command was ' + msg);
        } catch (err) {
          console.error('Failed to copy text: ', err);
        }
        // Deselect the text to avoid visual artifacts
        window.getSelection().removeAllRanges();
      }
    };
  };

  /* Connect (token is query parameter, add explicit audio request) */
  const connectString = `token=${encodeURIComponent(token)}&GUAC_AUDIO=audio/L16`;
  client.connect(connectString);

  /* Disconnect cleanly when the tab is closed / reloaded */
  window.addEventListener("beforeunload", () => client.disconnect());

  /* ----------------------- input handling ----------------------------- */

  /* Mouse */
  const mouse = new Guacamole.Mouse(client.getDisplay().getElement());
  mouse.onEach(['mousedown', 'mouseup', 'mousemove', 'mousewheel'],
               e => client.sendMouseState(e.state));

  /* Keyboard */
  const keyboard = new Guacamole.Keyboard(window);
  keyboard.onkeydown = keysym => client.sendKeyEvent(1, keysym);
  keyboard.onkeyup   = keysym => client.sendKeyEvent(0, keysym);

  /* Handle paste events from the browser */
  window.addEventListener('paste', event => {
    const text = event.clipboardData.getData('text/plain');
    if (text) {
      event.preventDefault(); // Prevent default paste behavior in browser
      // Send clipboard data to the remote session
      const stream = client.createClipboardStream('text/plain');
      const writer = new Guacamole.StringWriter(stream);
      writer.sendText(text);
      writer.sendEnd();
      console.log("Sent clipboard data to remote:", text);
    }
  });

}
