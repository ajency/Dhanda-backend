const logger = require("simple-node-logger").createSimpleLogger({ timestampFormat:'YYYY-MM-DD HH:mm:ss.SSS' });
const helperService = new (require("../../services/HelperService"));
const businessService = new (require("../../services/v1/BusinessService"));
const userService = new (require("../../services/v1/UserService"));

module.exports = {
    addBusiness: async (req, res) => {
        try {
            /** Validate Request */
            let requestValid = helperService.validateRequiredRequestParams(req.body, 
                    [ "owner", "businessName", "currency", "salaryMonthType", "shiftHours" ]);
            if(!requestValid) {
                return res.status(200).send({ code: "error", message: "missing_params" });
            }

            let { refId, owner, businessName, currency, salaryMonthType, shiftHours } = req.body;

            /** Create a new business */
            let businessObj = {
                name: businessName,
                currency: currency,
                salaryMonthType: salaryMonthType,
                shiftHours: shiftHours
            } 

            if(refId === null) {
                /** Create a new business */
                await businessService.createBusinessForUser(req.user, businessObj);
            
                /** Update the user's name */
                await userService.updateUser({ name: owner }, req.user);
            } else {
                /** Update the business */
                let updateCount = await businessService.updateBusiness(refId, businessObj);
                if(updateCount[0] === 0) {
                    return res.status(200).send({ code: "error", message: "business_not_found" });
                }
            }

            return res.status(200).send({ code: "add_staff", message: "success" });
        } catch(err) {
            await logger.error("Exception in add business api: ", err);
            res.status(200).send({ code: "error", message: "error" });
        }
    },

    fetchBusiness: async (req, res) => {
        try {
            
            return res.status(200).send({ code: "success", message: "success" });
        } catch(err) {
            await logger.error("Exception in fetch business api: ", err);
            res.status(200).send({ code: "error", message: "error" });
        }
    }
}