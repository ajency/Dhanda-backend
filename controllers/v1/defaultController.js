const logger = require("simple-node-logger").createSimpleLogger({ timestampFormat:'YYYY-MM-DD HH:mm:ss.SSS' });
const helperService = new (require("../../services/HelperService"));
const taxonomyService = new (require("../../services/v1/TaxonomyService"));
const userService = new (require("../../services/v1/UserService"));
const ormService = new (require("../../services/OrmService"));
const moment = require("moment");
const ruleService = new (require("../../services/v1/RuleService"));
const businessService = new (require("../../services/v1/BusinessService"));

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
                if(req.query.type === "income_type" && ["pending_dues", "outstanding_balance"].includes(tx.value)) {
                    continue;
                }
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

            /** Fetch the user from token */
            let user = await userService.fetchUserFromToken(req.headers.authorization);

            if(user) {
                /** Update the last login time */
                ormService.updateModel("user", user.id, { last_login: new Date() });
            }

            /** Check if we need to force verification */
            if(user && !user.verified) {
                let firstStaffCreationDate = await userService.fetchFirstStaffUserCreationDate(user.id);
                firstStaffCreationDate = firstStaffCreationDate.length > 0 ? moment(firstStaffCreationDate[0].created_at) : moment();
                let facts = {
                    lastLogin: moment(),
                    firstStaffCreationDate: firstStaffCreationDate,
                    staffCount: await userService.fetchStaffCountFromUserId(user.id)

                }
                let ruleRes = await ruleService.executeRuleFor("force_user_verification", facts, null);
                if(ruleRes) {
                    await logger.error("Forcing user verification for user: " + user.id);
                    let business = await userService.fetchDefaultBusinessForUser(user.id);
                    return res.status(200).send({ code: "verify_user", message: "success", data: {
                        businessRefId: business.reference_id,
                        phCountryCode: business.ph_country_code,
                        phone: business.phone
                    } });
                }
            }

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
        let minifiedRuleJson = [];
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
    },

    getProfile: async (req, res) => {
        try {
            /** Fetch user details */
            let user = await userService.fetchUserById(req.user);
            if(!user) {
                return res.status(200).send({ code: "error", message: "user_not_found" }); 
            }

            let business = await userService.fetchDefaultBusinessForUser(req.user);

            /** If business not found, check if this an admin */
            if(!business) {
                business = await businessService.fetchBusinessForRoleUser(req.user, "business_admin");
            }
            
            let data = {
                name: user.name,
                lang: user.lang,
                verified: user.verified,
                countryCode: user.country_code,
                phone: user.phone,
                defaultBusinessRefId: business ? business.reference_id : ""
            }

            /** If user doesn't have a phone number (i.e. user is unverified), fetch it from the business */
            if(!user.country_code || !user.phone) {
                data.countryCode = business ? business.ph_country_code : "";
                data.phone = business ? business.phone : "";
            }

            return res.status(200).send({ code: "success", message: "success", data: data });
        } catch(err) {
            await logger.error("Exception in get profile api: ", err);
            return res.status(200).send({ code: "error", message: "error" });
        }
    }
}