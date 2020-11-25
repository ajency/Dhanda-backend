const logger = require("simple-node-logger").createSimpleLogger({ timestampFormat:'YYYY-MM-DD HH:mm:ss.SSS' });
const helperService = new (require("../../services/HelperService"));
const taxonomyService = new (require("../../services/v1/TaxonomyService"));
const userService = new (require("../../services/v1/UserService"));

module.exports = {
    default: (req, res) => {
        res.status(200).send("Root");
    },

    fetchTaxonomyValues: async (req, res) => {
        try {
            /** Validate Request */
            let requestValid = helperService.validateRequiredRequestParams(req.query, [ "type" ]);
            if(!requestValid) {
                await logger.info("Fetch taxonomy values - missing params");
                return res.status(200).send({ code: "error", message: "missing_params" });
            }

            /** Fetch the taxonomies for the type */
            let taxonomies = await taxonomyService.fetchTaxonomyForType(req.query.type, true);

            if(taxonomies.length === 0) {
                await logger.info("Fetch taxonomy values - taxonomies not found for: " + req.query.type);
                return res.status(200).send({ code: "error", message: "taxonomy_not_found" });
            }

            /** Format the data */
            let taxonomyValues = [];
            for(let tx of taxonomies) {
                taxonomyValues.push({ key: tx.value, label: tx.default_label });
            }
            let data = {
                taxonomyValues: taxonomyValues
            }

            return res.status(200).send({ code: "success", message: "success", data: data });
        } catch(err) {
            await logger.error("Exception in fetch taxonomy api: ", err);
            return res.status(200).send({ code: "error", message: "error" });
        }
    },

    coldStart: async (req, res) => {
        try {
            /** Fetch the cold start api defaults */
            let coldStartApiDefaults = await helperService.getDefaultsValue("cold_start_api_defaults");
            let data = (coldStartApiDefaults) ? coldStartApiDefaults.meta : {};

            /** Get the post login code for the user */
            let postLoginObj = await userService.fetchPostLoginCodeForUserByToken(req.headers.authorization);
            if(postLoginObj.hasOwnProperty("data")) {
                data = { ...data, ...postLoginObj.data }
            }

            return res.status(200).send({ code: postLoginObj.code, message: "success", data: data });
        } catch(err) {
            await logger.error("Exception in cold start api: ", err);
            return res.status(200).send({ code: "error", message: "error" });
        }
    },

    addRule: async (req, res) => {
        let minifiedRuleJson = '';
        return res.send(helperService.rulesToJSON(minifiedRuleJson));
    },

    updateProfile: async (req, res) => {
        try {
            /** Validate Request */
            let requestValid = helperService.validateRequiredRequestParams(req.body, [ "lang" ]);
            if(!requestValid) {
                await logger.info("Update profile api - missing params");
                return res.status(200).send({ code: "error", message: "missing_params" });
            }

            let { lang } = req.body;

            /** Update the details */
            await userService.updateUser({ lang: lang }, req.user);

            return res.status(200).send({ code: "success", message: "success" });
        } catch(err) {
            await logger.error("Exception in update profile api: ", err);
            return res.status(200).send({ code: "error", message: "error" });
        }
    }
}