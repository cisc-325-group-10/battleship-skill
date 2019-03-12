'use strict';

const { execSync } = require('child_process');
const os = require('os');

class Plugin {
    constructor(serverless, options) {
        this.serverless = serverless;
        this.options = options;

        this.hooks = {
            'before:webpack:package:packageModules': this.deployCompileEvents.bind(this)
        };
    }

    deployCompileEvents() {
        this.serverless.cli.log("RUNNING PERMISSION CHANGE");
        switch (os.type()) {
            case "Linux":
                execSync("chmod -R ugo+rwx ./.webpack");
                break;
            default:
                this.serverless.cli.log("PERMISSION CHANGE DOESN'T SUPPORT THIS OS");
        }
    }
}

module.exports = Plugin;