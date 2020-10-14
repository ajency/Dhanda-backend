const logger = require("simple-node-logger").createSimpleLogger({ timestampFormat:'YYYY-MM-DD HH:mm:ss.SSS' });

module.exports = {
    default: (req, res) => {
        /** TODO: Remove this function */
        console.log(req.body);

        /** Sample DB connection code */
        // models.user.findOne().then((user) => {
        //     console.log(user.get("first_name"))
        // }).catch((err) => console.log(err));

        res.status(200).send("Root");
    },

    fetchTaxonomyValues: async (req, res) => {
        try {
            
            return res.status(200).send({ code: "success", message: "success" });
        } catch(err) {
            await logger.error("Exception in fetch taxonomy api: ", err);
            res.status(200).send({ code: "error", message: "error" });
        }
    }
}