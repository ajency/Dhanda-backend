const logger = require("simple-node-logger").createSimpleLogger({ timestampFormat:'YYYY-MM-DD HH:mm:ss.SSS' });

module.exports = {
    addBusiness: async (req, res) => {
        return res.status(200).send();
    }
}