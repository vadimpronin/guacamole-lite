const LOGLEVEL = {
    QUIET: 0,
    ERRORS: 10,
    NORMAL: 20,
    VERBOSE: 30,
    DEBUG: 40,
}


class Logger {
    constructor(logLevel, stdLog, errorLog, connectionId) {
        this.logLevel = logLevel;
        this.stdLog = stdLog || console.log;
        this.errorLog = errorLog || console.error;
        this.connectionId = connectionId || null;
    }

    log(level, ...args) {
        if (level > this.logLevel) {
            return;
        }

        let logFunc = this.stdLog;
        if (level === LOGLEVEL.ERRORS) {
            logFunc = this.errorLog;
        }

        logFunc(this.getLogPrefix(), ...args);
    }

    getLogPrefix() {
        // format: "YYYY-MM-DD HH:mm:ss"
        let currentTime = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');

        let prefix = `[${currentTime}] `;

        if (this.connectionId) {
            prefix += '[Connection #' + this.connectionId + '] ';
        }

        return prefix;
    }
}

module.exports = {
    LOGLEVEL,
    Logger: Logger,
};
