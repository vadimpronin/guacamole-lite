
export enum logLevel {
    QUIET= 0,
    ERRORS= 10,
    NORMAL= 20,
    VERBOSE= 30,
    DEBUG= 40,
  }

  export type type = "rdp"|"vnc"|"ssh"|"telnet"
  export type unencryptOptions = 'color-scheme'|'font-name'|'font-size'|'width'|'height'|'dpi'

  export interface settings{
    hostname: string;
    username: string;
    password: string;
    enable_drive: boolean;
    create_drive_path?: boolean;
    security?: string;
    ignore_cert?: boolean;
    enable_wallpaper?: boolean;
}

export interface default_settings {
    args?: string;
    port?: string|number;
    width?: number;
    height?: number;
    dpi?: number;
    security?: string;
    ignore_cert?: boolean;
    enable_wallpaper?: boolean;
    create_recording_path?: boolean;
    create_drive_path?: boolean;
}

export interface connection {
    type: type,
    settings: settings
}

export interface log_settings{
    level: logLevel;
    stdLog: any;
    errorLog: any;
}

export interface guacLiteOptions{
    connection?: connection;
    maxInactivityTime?: number;
    log: log_settings;
    connectionDefaultSettings: {
        rdp?: default_settings;
        vnc?: default_settings;
        ssh?: default_settings;
        telnet?: default_settings;
    }
    allowedUnencryptedConnectionSettings: {
        rdp?: unencryptOptions[];
        vnc?: unencryptOptions[];
        ssh?: unencryptOptions[];
        telnet?: unencryptOptions[];
    }
}

export interface guacdOptions{
    host?: string;
    port: number;
}

export interface GuacdServer extends GuacdServer {}