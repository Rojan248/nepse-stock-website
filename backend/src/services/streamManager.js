const EventEmitter = require('events');

class StreamManager extends EventEmitter {
    constructor() {
        super();
        // Increase limit if many triggers are added
        this.setMaxListeners(20);
    }
}

// Export singleton instance
module.exports = new StreamManager();
