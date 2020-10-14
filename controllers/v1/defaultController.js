const logger = require("simple-node-logger").createSimpleLogger({ timestampFormat:'YYYY-MM-DD HH:mm:ss.SSS' });
const helperService = new (require("../../services/HelperService"));
const taxonomyService = new (require("../../services/v1/TaxonomyService"));

module.exports = {
    default: (req, res) => {
        res.status(200).send("Root");
    },

    fetchTaxonomyValues: async (req, res) => {
        try {
            /** Validate Request */
            let requestValid = helperService.validateRequiredRequestParams(req.query, [ "type" ]);
            if(!requestValid) {
                return res.status(200).send({ code: "error", message: "missing_params" });
            }

            /** Fetch the taxonomies for the type */
            let taxonomies = await taxonomyService.fetchTaxonomyForType(req.query.type, true);

            if(taxonomies.length === 0) {
                return res.status(200).send({ code: "error", message: "taxonomy_not_found" });
            }

            /** Format the data */
            let taxonomyValues = [];
            for(let tx of taxonomies) {
                taxonomyValues.push({ key: tx.value });
            }
            let data = {
                taxonomyValues: taxonomyValues
            }

            return res.status(200).send({ code: "success", message: "success", data: data });
        } catch(err) {
            await logger.error("Exception in fetch taxonomy api: ", err);
            res.status(200).send({ code: "error", message: "error" });
        }
    }
}