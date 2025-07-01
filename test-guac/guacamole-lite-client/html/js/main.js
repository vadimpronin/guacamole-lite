// DOM elements
const connectionScreen = document.getElementById('connection-screen');
const displayScreen = document.getElementById('display-screen');
const connectTargetRadios = document.querySelectorAll('input[name="connect-target"]');
const remoteHostDetailsDiv = document.getElementById('remote-host-details');
const connectButton = document.getElementById('connect-button');
const closeButton = document.getElementById('close-button');
const protocolRadios = document.querySelectorAll('input[name="protocol"]');
const connectionTypeRadios = document.querySelectorAll('input[name="connection-type"]');
const remoteHostnameInput = document.getElementById('remote-hostname');
const remoteUsernameInput = document.getElementById('remote-username');
const remotePasswordInput = document.getElementById('remote-password');
const joinConnectionDetailsDiv = document.getElementById('join-connection-details');
const connectionIdInput = document.getElementById('connection-id');
const readOnlyCheckbox = document.getElementById('read-only');
const displayUuid = document.getElementById('display-uuid');

let currentClient = null; // Store the current Guacamole client
let currentKeyboard = null; // Store the keyboard handler
let pasteEventListener = null; // Store the paste event listener reference

// Helper function to get selected radio value
function getSelectedRadioValue(name) {
    const el = document.querySelector(`input[name="${name}"]:checked`);
    return el ? el.value : null;
}

// Centralised form visibility handler ----------------------------------
function updateFormVisibility() {
    const mode = getSelectedRadioValue('connection-type');

    if (!mode) {
        // Nothing selected – hide everything except connection-type row
        document.getElementById('connect-target').closest('.form-row').style.display = 'none';
        document.getElementById('protocol').closest('.form-row').style.display = 'none';
        remoteHostDetailsDiv.classList.remove('visible');
        joinConnectionDetailsDiv.classList.remove('visible');
        joinConnectionDetailsDiv.hidden = true;
        return;
    }

    if (mode === 'join') {
        // Hide everything related to new connections
        document.getElementById('connect-target').closest('.form-row').style.display = 'none';
        document.getElementById('protocol').closest('.form-row').style.display = 'none';
        remoteHostDetailsDiv.classList.remove('visible');

        // Show join-specific section
        joinConnectionDetailsDiv.classList.add('visible');
        joinConnectionDetailsDiv.hidden = false;
    } else {
        // Show new-connection inputs
        document.getElementById('connect-target').closest('.form-row').style.display = '';
        document.getElementById('protocol').closest('.form-row').style.display = '';
        joinConnectionDetailsDiv.classList.remove('visible');
        joinConnectionDetailsDiv.hidden = true;

        // Show remote host details only when "Remote Host" is chosen
        if (getSelectedRadioValue('connect-target') === 'remote-host') {
            remoteHostDetailsDiv.classList.add('visible');
            remoteHostDetailsDiv.hidden = false;
        } else {
            remoteHostDetailsDiv.classList.remove('visible');
            remoteHostDetailsDiv.hidden = true;
        }
    }
}

// Bind the visibility handler to all relevant radio groups
[...connectionTypeRadios, ...connectTargetRadios, ...protocolRadios].forEach(radio => {
    radio.addEventListener('change', updateFormVisibility);
});

// Initialise form visibility on page load
updateFormVisibility();

// Connect button click handler
connectButton.addEventListener('click', async () => {
    const mode = getSelectedRadioValue('connection-type');
    let tokenObj;
    let protocol = null;

    if (mode === 'join') {
        // Handle joining an existing connection
        const connectionId = connectionIdInput.value.trim();
        if (!connectionId) {
            alert('Please enter a connection ID to join');
            return;
        }

        tokenObj = {
            connection: {
                join: connectionId,
                settings: {
                    'read-only': readOnlyCheckbox.checked
                }
            }
        };
    } else {
        protocol = getSelectedRadioValue('protocol');
        if (!protocol) {
            alert('Please select a protocol');
            return;
        }
        // Handle regular connection
        const target = getSelectedRadioValue('connect-target');
        let connectionSettings;

        // Base connection settings
        connectionSettings = {
            hostname: target === 'test-host' ? 'desktop-linux' : remoteHostnameInput.value,
            username: target === 'test-host' ? 'testuser' : remoteUsernameInput.value,
            password: target === 'test-host' ? 'Passw0rd!' : remotePasswordInput.value,
        };

        if (protocol === 'rdp') {
            Object.assign(connectionSettings, {
                "ignore-cert": true,
                "security": "any",
                "enable-drive": true,
                "drive-path": "/tmp/guac-drive",
                "create-drive-path": true,
                "enable-printing": true,
                "audio": ["audio/L16;rate=44100"]
            });
        }

        // Add VNC-specific settings
        if (protocol === 'vnc') {
            Object.assign(connectionSettings, {
                port: 5900,
                autoretry: 3,
                color_depth: 24,
                swap_red_blue: false,
                connect_timeout: 15
            });
        }

        tokenObj = {
            connection: {
                type: protocol,
                settings: connectionSettings
            }
        };
    }

    try {
        // Clear previous display if any
        const displayDiv = document.getElementById('display');
        while (displayDiv.firstChild) {
            displayDiv.removeChild(displayDiv.firstChild);
        }

        console.log("Generating token for:", tokenObj);
        if (mode === 'join') {
            console.log(`Joining existing connection: ${tokenObj.connection.join}, read-only: ${tokenObj.connection.settings['read-only']}`);
        } else {
            const settings = tokenObj.connection.settings;
            console.log(`Connecting with ${protocol.toUpperCase()} to ${settings.hostname}:${settings.port || (protocol === 'rdp' ? '3389' : '5900')}`);
        }
        const token = await generateGuacamoleToken(tokenObj);
        console.log("Token generated, initializing Guacamole...");

        // Initialize Guacamole client
        initializeGuacamoleClient(token, mode === 'join' ? 'join' : protocol);
    } catch (error) {
        console.error("Failed to connect:", error);
        alert("Connection failed: " + error.message);

        // Switch back to connection screen on error
        displayScreen.style.display = 'none';
        connectionScreen.style.display = 'flex';
    }
});

// Function to initialize Guacamole client
function initializeGuacamoleClient(token, protocol) {
    // Switch to display screen before initializing to avoid UI jumping
    connectionScreen.style.display = 'none';
    displayScreen.style.display = 'flex';

    // Update display title with connection info
    const displayTitle = document.getElementById('display-title');
    if (protocol === 'join') {
        const connectionId = connectionIdInput.value.trim();
        const readOnly = readOnlyCheckbox.checked ? ' (read-only)' : '';
        displayTitle.textContent = `Joined connection: ${connectionId}${readOnly}`;
    } else {
        const target = getSelectedRadioValue('connect-target');
        displayTitle.textContent = `Connected to: ${target === 'test-host' ? 'Test Host' : remoteHostnameInput.value} (${protocol.toUpperCase()})`;
    }

    try {
        // Create WebSocket tunnel
        const tunnel = new Guacamole.WebSocketTunnel(`ws://${location.hostname}:9091/`);

        // Set up onuuid event handler to log connection ID
        tunnel.onuuid = function (uuid) {
            console.log("Connection UUID received:", uuid);
            console.log("This UUID can be used to join this session from another client");

            // Show UUID in the header and store for copying
            if (displayUuid) {
                displayUuid.dataset.uuid = uuid;
                displayUuid.textContent = `ID: ${uuid}`;
            }
        };

        // Create client
        const client = new Guacamole.Client(tunnel);
        currentClient = client;

        // Add client display to the page
        const displayDiv = document.getElementById("display");
        displayDiv.appendChild(client.getDisplay().getElement());

        // Set up error handler
        client.onerror = function (error) {
            console.error("Guacamole error:", error);
            let errorMessage = error.message || "Unknown error";

            // Enhanced error messages for common issues
            if (protocol === 'vnc' && errorMessage.includes("connect")) {
                errorMessage = "VNC Connection Error: Could not connect to VNC server. Please verify the host is running a VNC server on port 5900.";
            } else if (protocol === 'rdp' && errorMessage.includes("connect")) {
                errorMessage = "RDP Connection Error: Could not connect to RDP server. Please verify the host is running and accepting RDP connections.";
            }

            alert("Guacamole error: " + errorMessage);
        };

        // Set up clipboard handler
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

        // Set up file download handler
        client.onfile = (stream, mimetype, filename) => {
            stream.sendAck("Ready", Guacamole.Status.Code.SUCCESS);

            const reader = new Guacamole.BlobReader(stream, mimetype);

            reader.onprogress = (length) => {
                console.log(`Downloaded ${length} bytes of ${filename}`);
            };

            reader.onend = () => {
                // Automatically create a link and download the file
                const file = reader.getBlob();
                const url = URL.createObjectURL(file);
                const a = document.createElement("a");
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    console.log(`File download complete: ${filename}`);
                }, 100);
            };
        };

        // Set up mouse
        const mouse = new Guacamole.Mouse(client.getDisplay().getElement());
        mouse.onEach(['mousedown', 'mouseup', 'mousemove', 'mousewheel'],
            e => client.sendMouseState(e.state));

        // Set up keyboard
        const keyboard = new Guacamole.Keyboard(window);
        keyboard.onkeydown = keysym => client.sendKeyEvent(1, keysym);
        keyboard.onkeyup = keysym => client.sendKeyEvent(0, keysym);
        currentKeyboard = keyboard;

        // Set up paste event listener
        pasteEventListener = (event) => {
            const text = event.clipboardData.getData('text/plain');
            if (text && currentClient) {
                event.preventDefault(); // Prevent default paste behavior in browser
                // Send clipboard data to the remote session
                const stream = currentClient.createClipboardStream('text/plain');
                const writer = new Guacamole.StringWriter(stream);
                writer.sendText(text);
                writer.sendEnd();
                console.log("Sent clipboard data to remote:", text);
            }
        };
        window.addEventListener('paste', pasteEventListener);

        // Connect to the remote desktop
        // Construct connection string, adding audio only if RDP
        let connectString = `token=${encodeURIComponent(token)}`;
        if (protocol === 'rdp') {
            connectString += `&GUAC_AUDIO=audio/L16`;
        }
        client.connect(connectString);

        console.log("Guacamole client initialized and connected");
    } catch (error) {
        // Clean up any partially created resources
        cleanupGuacamole();

        // Show error and return to connection screen
        console.error("Error initializing Guacamole:", error);
        alert("Error initializing Guacamole: " + error.message);
        displayScreen.style.display = 'none';
        connectionScreen.style.display = 'flex';
    }
}

// Close button click handler
closeButton.addEventListener('click', () => {
    cleanupGuacamole();

    // Switch back to connection screen
    displayScreen.style.display = 'none';
    connectionScreen.style.display = 'flex';
});

// Function to properly clean up all Guacamole resources
function cleanupGuacamole() {
    if (currentClient) {
        // Disconnect the client
        try {
            currentClient.disconnect();
        } catch (e) {
            console.error("Error disconnecting client:", e);
        }
        currentClient = null;
    }

    // Clear displayed UUID
    if (displayUuid) {
        displayUuid.textContent = '';
        delete displayUuid.dataset.uuid;
    }

    // Properly detach keyboard handler
    if (currentKeyboard) {
        try {
            // Remove existing handlers
            currentKeyboard.onkeydown = null;
            currentKeyboard.onkeyup = null;

            // Reset the keyboard state completely
            currentKeyboard.reset();
        } catch (e) {
            console.error("Error cleaning up keyboard:", e);
        }
        currentKeyboard = null;
    }

    // Remove paste event listener if it exists
    if (pasteEventListener) {
        window.removeEventListener('paste', pasteEventListener);
        pasteEventListener = null;
    }

    // Allow a brief moment for cleanup before making inputs focusable
    setTimeout(() => {
        // Re-focus on a form element to help ensure keyboard is working
        const firstInput = document.querySelector('#connection-form input, #connection-form select');
        if (firstInput) {
            firstInput.focus();
        }
    }, 100);
}

// Add click-to-copy behavior for UUID
if (displayUuid) {
    displayUuid.addEventListener('click', () => {
        const uuid = displayUuid.dataset.uuid;
        if (!uuid) return;

        // Use Clipboard API if available, fallback to old execCommand
        const copyPromise = navigator.clipboard
            ? navigator.clipboard.writeText(uuid)
            : new Promise((resolve, reject) => {
                  const textarea = document.createElement('textarea');
                  textarea.value = uuid;
                  textarea.style.position = 'fixed';
                  textarea.style.left = '-9999px';
                  document.body.appendChild(textarea);
                  textarea.select();
                  try {
                      document.execCommand('copy');
                      resolve();
                  } catch (err) {
                      reject(err);
                  } finally {
                      document.body.removeChild(textarea);
                  }
              });

        copyPromise
            .then(() => {
                const original = displayUuid.textContent;
                displayUuid.textContent = 'Copied!';
                setTimeout(() => {
                    displayUuid.textContent = original;
                }, 1500);
            })
            .catch(err => console.error('Failed to copy UUID:', err));
    });
}

// Handle page unloads to clean up any active sessions
window.addEventListener('beforeunload', () => {
    cleanupGuacamole();
}); 
