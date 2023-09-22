import { EventEmitter } from "ws";

export enum logLevel {
    QUIET= 0,
    ERRORS= 10,
    NORMAL= 20,
    VERBOSE= 30,
    DEBUG= 40,
  }

  export type type = "rdp"|"vnc"|"ssh"|"telnet"
  export type vncUnencryptOptions = 'autoretry'|'color-depth'|'swap-red-blue'|'cursor'|'encodings'|'read-only'|'force-lossless'|'dest-host'|'reverse-connect'|'listen-timeout'|'enable-audio'|'audio-servername'|'clipboard-encoding'
  export type rdpUnencryptOptions = 'normalize-clipboard'|'server-layout'|'timezone'|'color-depth'|'width'|'height'|'dpi'|'resize-method'|'force-lossless'|'disable-audio'|'enable-audio-input'|'enable-touch'|'enable-printing'|'enable-drive'|'disable-download'|'disable-upload'|'enable-wallpaper'|'enable-theming'|'enable-font-smoothing'|'enable-full-window-drag'|'enable-desktop-composition'|'enable-menu-animations'|'disable-bitmap-caching'|'disable-offscreen-caching'|'disable-glyph-caching'
  export type sshUnencryptOptions = 'locale'|'timezone'|'enable-sftp'|'sftp-disable-download'|'sftp-disable-upload'

export interface vnc_settings{
    /**
     * The hostname or IP address of the VNC server Guacamole should connect to.
     */
    hostname: string;
    /**
     * The username to use when attempting authentication, if any. This parameter is optional.
     */
    username?: string;
    /**
     * The password to use when attempting authentication, if any. This parameter is optional.
     */
    password?: string;
    /**
     * The port the VNC server is listening on, usually 5900 or 5900 + display number. For example, if your VNC server is serving display number 1 (sometimes written as :1), your port number here would be 5901.
     */
    port: string;
    /**
     * The number of times to retry connecting before giving up and returning an error. In the case of a reverse connection, this is the number of times the connection process is allowed to time out.
     */
    autoretry?: number;
    /**
     * The color depth to request, in bits-per-pixel. This parameter is optional. If specified, this must be either 8, 16, 24, or 32. Regardless of what value is chosen here, if a particular update uses less than 256 colors, Guacamole will always send that update as a 256-color PNG.
     */
    "color-depth"?: 8|16|24|32;
    /**
     * If the colors of your display appear wrong (blues appear orange or red, etc.), it may be that your VNC server is sending image data incorrectly, and the red and blue components of each color are swapped. If this is the case, set this parameter to “true” to work around the problem. This parameter is optional.
     */
    "swap-red-blue"?: boolean;
    /**
     * If set to “remote”, the mouse pointer will be rendered remotely, and the local position of the mouse pointer will be indicated by a small dot. A remote mouse cursor will feel slower than a local cursor, but may be necessary if the VNC server does not support sending the cursor image to the client.
     */
    cursor?: "remote";
    /**
     * A space-delimited list of VNC encodings to use. The format of this parameter is dictated by libvncclient and thus doesn’t really follow the form of other Guacamole parameters. This parameter is optional, and libguac-client-vnc will use any supported encoding by default.

        Beware that this parameter is intended to be replaced with individual, encoding-specific parameters in a future release.
        */
    encodings?: string;
    /**
     * Whether this connection should be read-only. If set to “true”, no input will be accepted on the connection at all. Users will only see the desktop and whatever other users using that same desktop are doing. This parameter is optional.
     */
    "read-only"?: boolean;
    /**
     * Whether this connection should only use lossless compression for graphical updates. If set to “true”, lossy compression will not be used. This parameter is optional. By default, lossy compression will be used when heuristics determine that it would likely outperform lossless compression.
     */
    "force-lossless"?: boolean;
    /**
     * The destination host to request when connecting to a VNC proxy such as UltraVNC Repeater. This is only necessary if the VNC proxy in use requires the connecting user to specify which VNC server to connect to. If the VNC proxy automatically connects to a specific server, this parameter is not necessary.
     */
    "dest-host"?: string;
    /**
     * The destination port to request when connecting to a VNC proxy such as UltraVNC Repeater. This is only necessary if the VNC proxy in use requires the connecting user to specify which VNC server to connect to. If the VNC proxy automatically connects to a specific server, this parameter is not necessary.
     */
    "dest-port"?: number | string;
    /**
     * Whether reverse connection should be used. If set to “true”, instead of connecting to a server at a given hostname and port, guacd will listen on the given port for inbound connections from a VNC server.
     */
    "reverse-connect"?: boolean;
    /**
     * If reverse connection is in use, the maximum amount of time to wait for an inbound connection from a VNC server, in milliseconds. If blank, the default value is 5000 (five seconds).
     */
    "listen-timeout"?:number;
    /**
     * If set to “true”, audio support will be enabled, and a second connection for PulseAudio will be made in addition to the VNC connection. By default, audio support within VNC is disabled.
     */
    "enable-audio"?:boolean;
    /**
     * The name of the PulseAudio server to connect to. This will be the hostname of the computer providing audio for your connection via PulseAudio, most likely the same as the value given for the hostname parameter.

        If this parameter is omitted, the default PulseAudio device will be used, which will be the PulseAudio server running on the same machine as guacd.
        */
    "audio-servername"?: string;
    /**
     * The encoding to assume for the VNC clipboard. This parameter is optional. By default, the standard encoding ISO 8859-1 will be used. Only use this parameter if you are sure your VNC server supports other encodings beyond the standard ISO 8859-1.

        Possible values are:

        ISO8859-1
        ISO 8859-1 is the clipboard encoding mandated by the VNC standard, and supports only basic Latin characters. Unless your VNC server specifies otherwise, this encoding is the only encoding guaranteed to work.

        UTF-8
        UTF-8 - the most common encoding used for Unicode. Using this encoding for the VNC clipboard violates the VNC specification, but some servers do support this. This parameter value should only be used if you know your VNC server supports this encoding.

        UTF-16
        UTF-16 - a 16-bit encoding for Unicode which is not as common as UTF-8, but still widely used. Using this encoding for the VNC clipboard violates the VNC specification. This parameter value should only be used if you know your VNC server supports this encoding.

        CP1252
        Code page 1252 - a Windows-specific encoding for Latin characters which is mostly a superset of ISO 8859-1, mapping some additional displayable characters onto what would otherwise be control characters. Using this encoding for the VNC clipboard violates the VNC specification. This parameter value should only be used if you know your VNC server supports this encoding.
        * 
        */
    "clipboard-encoding"?: "ISO8859-1"|"UTF-8"|"UTF-16"|"CP1252"
}

export interface rdp_settings{
    /**
     * The hostname or IP address of the RDP server Guacamole should connect to.
    */
    hostname: string;
    /**
     * The port the RDP server is listening on. This parameter is optional. If this is not specified, the standard port for RDP (3389) or Hyper-V’s default port for VMConnect (2179) will be used, depending on the security mode selected.
    */
    port?:  string;
        /**
     * The username to use when attempting authentication, if any. This parameter is optional.
     */
    username?: string;
    /**
     * The password to use when attempting authentication, if any. This parameter is optional.
     */
    password?: string;
    /**
     * The domain to use when attempting authentication, if any. This parameter is optional.
     */
    dommain?: string;
    /**
     * The security mode to use for the RDP connection. This mode dictates how data will be encrypted and what type of authentication will be performed, if any. By default, a security mode is selected based on a negotiation process which determines what both the client and the server support.

        Possible values are:

        any
        Automatically select the security mode based on the security protocols supported by both the client and the server. This is the default.

        nla
        Network Level Authentication, sometimes also referred to as “hybrid” or CredSSP (the protocol that drives NLA). This mode uses TLS encryption and requires the username and password to be given in advance. Unlike RDP mode, the authentication step is performed before the remote desktop session actually starts, avoiding the need for the Windows server to allocate significant resources for users that may not be authorized.

        If the versions of guacd and Guacamole Client in use support prompting and the username, password, and domain are not specified, the user will be interactively prompted to enter credentials to complete NLA and continue the connection. Otherwise, when prompting is not supported and credentials are not provided, NLA connections will fail.

        nla-ext
        Extended Network Level Authentication. This mode is identical to NLA except that an additional “Early User Authorization Result” is required to be sent from the server to the client immediately after the NLA handshake is completed.

        tls
        RDP authentication and encryption implemented via TLS (Transport Layer Security). Also referred to as RDSTLS, the TLS security mode is primarily used in load balanced configurations where the initial RDP server may redirect the connection to a different RDP server.

        vmconnect
        Automatically select the security mode based on the security protocols supported by both the client and the server, limiting that negotiation to only the protocols known to be supported by Hyper-V / VMConnect.

        rdp
        Legacy RDP encryption. This mode is generally only used for older Windows servers or in cases where a standard Windows login screen is desired. Newer versions of Windows have this mode disabled by default and will only accept NLA unless explicitly configured otherwise.
        * 
        */
    security?: "any"|"nla"|"nla-ext"|"tls"|"vmconnect"|"rdp";
    /**
     *  If set to “true”, the certificate returned by the server will be ignored, even if that certificate cannot be validated. This is useful if you universally trust the server and your connection to the server, and you know that the server’s certificate cannot be validated (for example, if it is self-signed)
     */
    "ignore-cert"?: boolean;
    /**
     * If set to “true”, authentication will be disabled. Note that this refers to authentication that takes place while connecting. Any authentication enforced by the server over the remote desktop session (such as a login dialog) will still take place. By default, authentication is enabled and only used when requested by the server.

        If you are using NLA, authentication must be enabled by definition.
        * 
        */
    "disable-auth"?: boolean;
    /**
     * The type of line ending normalization to apply to text within the clipboard, if any. By default, line ending normalization is not applied.

        Possible values are:

        preserve
        Preserve all line endings within the clipboard exactly as they are, performing no normalization whatsoever. This is the default.

        unix
        Automatically transform all line endings within the clipboard to Unix-style line endings (LF). This format of line ending is the format used by both Linux and Mac.

        windows
        Automatically transform all line endings within the clipboard to Windows-style line endings (CRLF).
        */
    "normalize-clipboard"?: "preserve"|"unix"|"windows";
    /**
     * When connecting to the RDP server, Guacamole will normally provide its own hostname as the name of the client. If this parameter is specified, Guacamole will use its value instead.

        On Windows RDP servers, this value is exposed within the session as the CLIENTNAME environment variable.
        */
    "client-name"?: string;
    /**
     * If set to “true”, you will be connected to the console (admin) session of the RDP server.
     */
    console?: booleam;
    /**
     * The server-side keyboard layout. This is the layout of the RDP server and has nothing to do with the keyboard layout in use on the client. The Guacamole client is independent of keyboard layout. The RDP protocol, however, is not independent of keyboard layout, and Guacamole needs to know the keyboard layout of the server in order to send the proper keys when a user is typing.

        Possible values are generally in the format LANGUAGE-REGION-VARIANT, where LANGUAGE is the standard two-letter language code for the primary language associated with the layout, REGION is a standard representation of the location that the keyboard is used (the two-letter country code, when possible), and VARIANT is the specific keyboard layout variant (such as “qwerty”, “qwertz”, or “azerty”):

        | Keyboard layout			    | Parameter value   | 
        | ------------------------------| -----------------:|
        | Brazilian (Portuguese)        | pt-br-qwerty      |
        | English (UK)                  | en-gb-qwerty      |
        | English (US)                  | en-us-qwerty      |
        | French                        | fr-fr-azerty      |
        | French (Belgian)              | fr-be-azerty      |
        | French (Swiss)                | fr-ch-qwertz      |
        | German                        | de-de-qwertz      |
        | German (Swiss)                | de-ch-qwertz      |
        | Hungarian                     | hu-hu-qwertz      |
        | Italian                       | it-it-qwerty      |
        | Japanese                      | ja-jp-qwerty      |
        | Norwegian                     | no-no-qwerty      |
        | Spanish                       | es-es-qwerty      |
        | Spanish (Latin American)      | es-latam-qwerty   |
        | Swedish                       | sv-se-qwerty      |
        | Turkish-Q                     | tr-tr-qwerty      |

        If you server’s keyboard layout is not yet supported, and it is not possible to set your server to use a supported layout, the failsafe layout may be used to force Unicode events to be used for all input, however beware that doing so may prevent keyboard shortcuts from working as expected.
        * 
        */
    "server-layout"?: string;
    /**
     * The timezone that the client should send to the server for configuring the local time display of that server. The format of the timezone is in the standard IANA key zone format, which is the format used in UNIX/Linux. This will be converted by RDP into the correct format for Windows.

        The timezone is detected and will be passed to the server during the handshake phase of the connection, and may used by protocols, like RDP, that support it. This parameter can be used to override the value detected and passed during the handshake, or can be used in situations where guacd does not support passing the timezone parameter during the handshake phase (guacd versions prior to 1.3.0).

        Support for forwarding the client timezone varies by RDP server implementation. For example, with Windows, support for forwarding timezones is only present in Windows Server with Remote Desktop Services (RDS, formerly known as Terminal Services) installed. Windows Server installations in admin mode, along with Windows workstation versions, do not allow the timezone to be forwarded. Other server implementations, for example, xrdp, may not implement this feature at all. Consult the documentation for the RDP server to determine whether or not this feature is supported.
        */
    timezone?: string;
    /**
     * The color depth to request, in bits-per-pixel. This parameter is optional. If specified, this must be either 8, 16, 24, or 32. Regardless of what value is chosen here, if a particular update uses less than 256 colors, Guacamole will always send that update as a 256-color PNG.
     */
    "color-depth"?: 8|16|24|32;
    /**
     * The width of the display to request, in pixels. This parameter is optional. If this value is not specified, the width of the connecting client display will be used instead.
     */
    width?: number;
    /**
     * The height of the display to request, in pixels. This parameter is optional. If this value is not specified, the height of the connecting client display will be used instead.
     */
    height?: number;
    /**
     * The desired effective resolution of the client display, in DPI. This parameter is optional. If this value is not specified, the resolution and size of the client display will be used together to determine, heuristically, an appropriate resolution for the RDP session.
     */
    dpi?: number;
    /**
     * The method to use to update the RDP server when the width or height of the client display changes. This parameter is optional. If this value is not specified, no action will be taken when the client display changes size.

        Normally, the display size of an RDP session is constant and can only be changed when initially connecting. As of RDP 8.1, the “Display Update” channel can be used to request that the server change the display size. For older RDP servers, the only option is to disconnect and reconnect with the new size.

        Possible values are:

        display-update
        Uses the “Display Update” channel added with RDP 8.1 to signal the server when the client display size has changed.

        reconnect
        Automatically disconnects the RDP session when the client display size has changed, and reconnects with the new size.
        * 
        */
    "resize-method"?: "display-update"|"reconnect";
    /**
     * Whether this connection should only use lossless compression for graphical updates. If set to “true”, lossy compression will not be used. This parameter is optional. By default, lossy compression will be used when heuristics determine that it would likely outperform lossless compression.
     * 
     */
    "force-lossless"?: boolean;
    /**
     * Audio is enabled by default in both the client and in libguac-client-rdp. If you are concerned about bandwidth usage, or sound is causing problems, you can explicitly disable sound by setting this parameter to “true”.
    */
    "disable-audio"?: boolean;
    /** 
     * If set to “true”, audio input support (microphone) will be enabled, leveraging the standard “AUDIO_INPUT” channel of RDP. By default, audio input support within RDP is disabled.
    */
    "enable-audio-input"?: boolean;
    /**
     * If set to “true”, support for multi-touch events will be enabled, leveraging the standard “RDPEI” channel of RDP. By default, direct RDP support for multi-touch events is disabled.
     * 
     * Enabling support for multi-touch allows touch interaction with applications inside the RDP session, however the touch gestures available will depend on the level of touch support of those applications and the OS.
     * 
     * If multi-touch support is not enabled, pointer-type interaction with applications inside the RDP session will be limited to mouse or emulated mouse events.
    */
    "enable-touch"?: boolean;
    /**
     * Printing is disabled by default, but with printing enabled, RDP users can print to a virtual printer that sends a PDF containing the document printed to the Guacamole client. Enable printing by setting this parameter to “true”.
     * 
     * Printing support requires GhostScript to be installed. If guacd cannot find the gs executable when printing, the print attempt will fail.
    */
    "enable-printing"?: boolean;
    /**
    * The name of the redirected printer device that is passed through to the RDP session. This is the name that the user will see in, for example, the Devices and Printers control panel.
    * 
    * If printer redirection is not enabled, this option has no effect.
    */
    "printer-name"?: string;
    /**
    * File transfer is disabled by default, but with file transfer enabled, RDP users can transfer files to and from a virtual drive which persists on the Guacamole server. Enable file transfer support by setting this parameter to “true”.
    * 
    * Files will be stored in the directory specified by the “drive-path” parameter, which is required if file transfer is enabled.
    */
    "enable-drive"?: boolean;
    /**
     * If set to true downloads from the remote server to client (browser) will be disabled. This includes both downloads done via the hidden Guacamole menu, as well as using the special “Download” folder presented to the remote server. The default is false, which means that downloads will be allowed.
    * 
    * If file transfer is not enabled, this parameter is ignored.
    */
    "disable-download"?: boolean;
    /**
     * If set to true, uploads from the client (browser) to the remote server location will be disabled. The default is false, which means uploads will be allowed if file transfer is enabled.
    *
    * If file transfer is not enabled, this parameter is ignored.
    */
    "disable-upload"?: boolean;
    /**
     * The name of the filesystem used when passed through to the RDP session. This is the name that users will see in their Computer/My Computer area along with client name (for example, “Guacamole on Guacamole RDP”), and is also the name of the share when accessing the special \\tsclient network location.
     *
     * If file transfer is not enabled, this parameter is ignored.
    */
    "drive-name"?: string;
    /**
     * The directory on the Guacamole server in which transferred files should be stored. This directory must be accessible by guacd and both readable and writable by the user that runs guacd. This parameter does not refer to a directory on the RDP server.
     * 
     * If file transfer is not enabled, this parameter is ignored.
    */
    "drive-path"?: string;
    /**
     * If set to “true”, and file transfer is enabled, the directory specified by the drive-path parameter will automatically be created if it does not yet exist. Only the final directory in the path will be created - if other directories earlier in the path do not exist, automatic creation will fail, and an error will be logged.
     * 
     * By default, the directory specified by the drive-path parameter will not automatically be created, and attempts to transfer files to a non-existent directory will be logged as errors.
     * 
     * If file transfer is not enabled, this parameter is ignored.
    */
    "create-drive-path"?: boolean;
    /**
     * If set to “true”, audio will be explicitly enabled in the console (admin) session of the RDP server. Setting this option to “true” only makes sense if the console parameter is also set to “true”.
    */
    "console-audio"?: boolean;
    /**
     * A comma-separated list of static channel names to open and expose as pipes. If you wish to communicate between an application running on the remote desktop and JavaScript, this is the best way to do it. Guacamole will open an outbound pipe with the name of the static channel. If JavaScript needs to communicate back in the other direction, it should respond by opening another pipe with the same name.
     * 
     * Guacamole allows any number of static channels to be opened, but protocol restrictions of RDP limit the size of each channel name to 7 characters.
    */
    "static-channels"?: string;
    /**
     * The numeric ID of the RDP source. This is a non-negative integer value dictating which of potentially several logical RDP connections should be used. This parameter is optional, and is only required if the RDP server is documented as requiring it. If using Hyper-V, this should be left blank.
     */
    "preconnection-id"?: string;
    /**
     * An arbitrary string which identifies the RDP source - one of potentially several logical RDP connections hosted by the same RDP server. This parameter is optional, and is only required if the RDP server is documented as requiring it, such as Hyper-V. In all cases, the meaning of this parameter is opaque to the RDP protocol itself and is dictated by the RDP server. For Hyper-V, this will be the ID of the destination virtual machine.
     */
    "preconnection-blob"?: string;
    /**
     * The hostname of the remote desktop gateway that should be used as an intermediary for the remote desktop connection. If omitted, a gateway will not be used.
    */
    "gateway-hostname"?: string;

    /**
    * The port of the remote desktop gateway that should be used as an intermediary for the remote desktop connection. By default, this will be “443”.
    */
    "gateway-port"?: number;

    /**
    * The username of the user authenticating with the remote desktop gateway, if a gateway is being used. This is not necessarily the same as the user actually using the remote desktop connection.
    */
    "gateway-username"?: string;
    /**
    * The password to provide when authenticating with the remote desktop gateway, if a gateway is being used.
    */
    "gateway-password"?: string;
    /** 
    * The domain of the user authenticating with the remote desktop gateway, if a gateway is being used. This is not necessarily the same domain as the user actually using the remote desktop connection.
    */
    "gateway-domain"?: string;
    /**
    * The load balancing information or cookie which should be provided to the connection broker. If no connection broker is being used, this should be left blank.
    */
    "load-balance-info"?: string;
    /**
    * If set to “true”, enables rendering of the desktop wallpaper. By default, wallpaper will be disabled, such that unnecessary bandwidth need not be spent redrawing the desktop.
    */
    "enable-wallpaper"?: boolean;
    /**
     * If set to “true”, enables use of theming of windows and controls. By default, theming within RDP sessions is disabled.
    */
    "enable-theming"?: boolean;
    /**
     * If set to “true”, text will be rendered with smooth edges. Text over RDP is rendered with rough edges by default, as this reduces the number of colors used by text, and thus reduces the bandwidth required for the connection.
    */
    "enable-font-smoothing"?: boolean;
    /**
     * If set to “true”, the contents of windows will be displayed as windows are moved. By default, the RDP server will only draw the window border while windows are being dragged.
    */
    "enable-full-window-drag"?: boolean;
    /**
     * If set to “true”, graphical effects such as transparent windows and shadows will be allowed. By default, such effects, if available, are disabled.
    */
    "enable-desktop-composition"?: boolean;
    /*
    * If set to “true”, menu open and close animations will be allowed. Menu animations are disabled by default.
    */
    "enable-menu-animations"?: boolean;
    /**
     * In certain situations, particularly with RDP server implementations with known bugs, it is necessary to disable RDP’s built-in bitmap caching functionality. This parameter allows that to be controlled in a Guacamole session. If set to “true” the RDP bitmap cache will not be used.
    */
    "disable-bitmap-caching"?: boolean;
    /**
     * RDP normally maintains caches of regions of the screen that are currently not visible in the client in order to accelerate retrieval of those regions when they come into view. This parameter, when set to “true,” will disable caching of those regions. This is usually only useful when dealing with known bugs in RDP server implementations and should remain enabled in most circumstances.
    */
    "disable-offscreen-caching"?: boolean;
    /**
     * In addition to screen regions, RDP maintains caches of frequently used symbols or fonts, collectively known as “glyphs.” As with bitmap and offscreen caching, certain known bugs in RDP implementations can cause performance issues with this enabled, and setting this parameter to “true” will disable that glyph caching in the RDP session.
     * 
     * Glyph caching is currently universally disabled, regardless of the value of this parameter, as glyph caching support is not considered stable by FreeRDP as of the FreeRDP 2.0.0 release. See: GUACAMOLE-1191.
    */
    "disable-glyph-caching"?: boolean;
    /**
     * Specifies the RemoteApp to start on the remote desktop. If supported by your remote desktop server, this application, and only this application, will be visible to the user.
     * 
     * Windows requires a special notation for the names of remote applications. The names of remote applications must be prefixed with two vertical bars. For example, if you have created a remote application on your server for notepad.exe and have assigned it the name “notepad”, you would set this parameter to: “||notepad”.
    */
    "remote-app"?: string;
    /**
     * The working directory, if any, for the remote application. This parameter has no effect if RemoteApp is not in use.
    */
    "remote-app-dir"?: string;
    /**
     * The command-line arguments, if any, for the remote application. This parameter has no effect if RemoteApp is not in use.
    */
    "remote-app-args"?: string;
}

export interface ssh_settings{
    /**
     * The hostname or IP address of the SSH server Guacamole should connect to.
     */
    hostname: string;
    /**
     * The port the SSH server is listening on, usually 22. This parameter is optional. If this is not specified, the default of 22 will be used.
     */
    port?: number

    /**
     * The known hosts entry for the SSH server. This parameter is optional, and, if not provided, no verification of host identity will be done. If the parameter is provided the identity of the server will be checked against the data.
     * 
     * The format of this parameter is that of a single entry from an OpenSSH known_hosts file.
     * 
     * For more information, please see SSH Host Verification.
    */
    "host-key"?: string;
    /**
     * By default the SSH client does not send keepalive requests to the server. This parameter allows you to configure the the interval in seconds at which the client connection sends keepalive packets to the server. The default is 0, which disables sending the packets. The minimum value is 2.
    */
    "server-alive-interval"?: number;
    /**
     * The username to use to authenticate, if any. This parameter is optional. If not specified, you will be prompted for the username upon connecting.
    */
    username?: string;
    /**
     * The password to use when attempting authentication, if any. This parameter is optional. If not specified, you will be prompted for your password upon connecting.
    */
    password?: string;
    /**
     * The entire contents of the private key to use for public key authentication. If this parameter is not specified, public key authentication will not be used. The private key must be in OpenSSH format, as would be generated by the OpenSSH ssh-keygen utility.
    */
    "private-key"?: string;
    /**
     * The passphrase to use to decrypt the private key for use in public key authentication. This parameter is not needed if the private key does not require a passphrase. If the private key requires a passphrase, but this parameter is not provided, the user will be prompted for the passphrase upon connecting.
    */
    passphrase?: string;
    /**
     * The command to execute over the SSH session, if any. This parameter is optional. If not specified, the SSH session will use the user’s default shell.
    */
    command?: string;
    /**
     * The specific locale to request for the SSH session. This parameter is optional and may be any value accepted by the LANG environment variable of the SSH server. If not specified, the SSH server’s default locale will be used.
     * 
     * As this parameter is sent to the SSH server using the LANG environment variable, the parameter will only have an effect if the SSH server allows the LANG environment variable to be set by SSH clients.
    */
    locale?: string; 
    /**
     * This parameter allows you to control the timezone that is sent to the server over the SSH connection, which will change the way local time is displayed on the server.
     * 
     * The mechanism used to do this over SSH connections is by setting the TZ variable on the SSH connection to the timezone specified by this parameter. This means that the SSH server must allow the TZ variable to be set/overriden - many SSH server implementations have this disabled by default. To get this to work, you may need to modify the configuration of the SSH server and explicitly allow for TZ to be set/overriden.
     * 
     * The available values of this parameter are standard IANA key zone format timezones, and the value will be sent directly to the server in this format.
    */
    timezone?: string;
    /**
     * Whether file transfer should be enabled. If set to “true”, the user will be allowed to upload or download files from the SSH server using SFTP. Guacamole includes the guacctl utility which controls file downloads and uploads when run on the SSH server by the user over the SSH connection.
    */
    "enable-sftp"?: boolean;
    /**
     * The directory to expose to connected users via Guacamole’s file browser. If omitted, the root directory will be used by default.
    */
    "sftp-root-directory"?: string;

    /**
     * If set to true downloads from the remote system to the client (browser) will be disabled. The default is false, which means that downloads will be enabled.
     * 
     * If SFTP is not enabled, this parameter will be ignored.
    */
    "sftp-disable-download"?: boolean;
    /**
     * If set to true uploads from the client (browser) to the remote system will be disabled. The default is false, which means that uploads will be enabled.
     * 
     * If SFTP is not enabled, this parameter will be ignored.
    */
    "sftp-disable-upload"?: boolean;
}

export interface telnet_settings{
    /**
     * The hostname or IP address of the telnet server Guacamole should connect to.
     */
    hostname: string;
    /**
     * The port the telnet server is listening on, usually 23. This parameter is optional. If this is not specified, the default of 23 will be used.
    */
    port?: number;
    /**
     * The username to use to authenticate, if any. This parameter is optional. If not specified, or not supported by the telnet server, the login process on the telnet server will prompt you for your credentials. For this to work, your telnet server must support the NEW-ENVIRON option, and the telnet login process must pay attention to the USER environment variable. Most telnet servers satisfy this criteria.
    */
    username?: string;
    /**
     * The password to use when attempting authentication, if any. This parameter is optional. If specified, your password will be typed on your behalf when the password prompt is detected.
    */
    password?: string;
    /**
     * The regular expression to use when waiting for the username prompt. This parameter is optional. If not specified, a reasonable default built into Guacamole will be used. The regular expression must be written in the POSIX ERE dialect (the dialect typically used by egrep).
    */
    "username-regex"?: string;
    /**
     * The regular expression to use when waiting for the password prompt. This parameter is optional. If not specified, a reasonable default built into Guacamole will be used. The regular expression must be written in the POSIX ERE dialect (the dialect typically used by egrep).
    */
    "password-regex"?: string;
    /**
     * The regular expression to use when detecting that the login attempt has succeeded. This parameter is optional. If specified, the terminal display will not be shown to the user until text matching this regular expression has been received from the telnet server. The regular expression must be written in the POSIX ERE dialect (the dialect typically used by egrep).
    */
    "login-success-regex"?: string;
    /**
     * The regular expression to use when detecting that the login attempt has failed. This parameter is optional. If specified, the connection will be closed with an explicit login failure error if text matching this regular expression has been received from the telnet server. The regular expression must be written in the POSIX ERE dialect (the dialect typically used by egrep).
     */
    "login-failure-regex"?: string;
}


export interface vnc_optional_settings extends vnc_settings {
    /**
     * The hostname or IP address of the VNC server Guacamole should connect to.
     */
    hostname?: string;
    /**
     * The port the VNC server is listening on, usually 5900 or 5900 + display number. For example, if your VNC server is serving display number 1 (sometimes written as :1), your port number here would be 5901.
     */
    port?: string;
}

export interface rdp_optional_settings extends rdp_settings {
    /**
     * The hostname or IP address of the VNC server Guacamole should connect to.
     */
    hostname?: string;
}

export interface ssh_optional_settings extends ssh_settings {
    /**
     * The hostname or IP address of the VNC server Guacamole should connect to.
     */
    hostname?: string;
}

export interface telnet_optional_settings extends telnet_settings {
    /**
     * The hostname or IP address of the VNC server Guacamole should connect to.
     */
    hostname?: string;
}

export interface vnc_connection {
    type: "vnc",
    settings: vnc_settings
}

export interface rdp_connection {
    type: "rdp",
    settings: rdp_settings
}

export interface ssh_connection {
    type: "ssh",
    settings: ssh_settings
}

export interface telnet_connection {
    type: "telnet",
    settings: telnet_settings
}

export interface log_settings{
    level: logLevel;
    stdLog: any;
    errorLog: any;
}

export interface guacLiteOptions{
    connection?: vnc_connection | rdp_connection | ssh_connection | telnet_connection;
    maxInactivityTime?: number;
    log: log_settings;
    connectionDefaultSettings: {
        vnc?: vnc_optional_settings;
        rdp?: rdp_optional_settings;
        ssh?: ssh_optional_settings;
        telnet?: telnet_optional_settings;
    }
    allowedUnencryptedConnectionSettings: {
        vnc?: vncUnencryptOptions[];
        rdp?: rdpUnencryptOptions[];
        ssh?: sshUnencryptOptions[];
    }
}

export interface guacdOptions{
    host?: string;
    port: number;
}

export interface GuacdServer extends GuacdServer, EventEmitter {}

/**
 * 
 * @param wsOptions       Express Server Options
 * @param guacdOptions    Guacd Connection Options
 * @param clientOptions   Guacamole Lite Ts Options
 * @param callbacks       Callback will be called prior to attempting a connection
 */
export function createGuacdServer(wsOptions: ServerOptions, 
    guacdOptions: guacdOptions, 
    clientOptions: guacLiteOptions, 
    callbacks: any): GuacdServer