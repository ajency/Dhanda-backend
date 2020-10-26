const logger = require("simple-node-logger").createSimpleLogger({ timestampFormat:'YYYY-MM-DD HH:mm:ss.SSS' });
const moment = require("moment");
const helperService = new (require("../../services/HelperService"));
const businessService = new (require("../../services/v1/BusinessService"));
const userService = new (require("../../services/v1/UserService"));
const staffService = new (require("../../services/v1/StaffService"));
const attendanceService = new (require("../../services/v1/AttendanceService"));

module.exports = {
    saveBusiness: async (req, res) => {
        try {
            /** Validate Request */
            let requestValid = helperService.validateRequiredRequestParams(req.body, 
                    [ "businessName", "currency", "salaryMonthType", "shiftHours"/*, "timezone", "countryCode"*/ ]);
            if(!requestValid) {
                return res.status(200).send({ code: "error", message: "missing_params" });
            }

            let { refId, owner, businessName, currency, salaryMonthType, shiftHours, timezone, countryCode } = req.body;

            /** Create a new business */
            let businessObj = {
                name: businessName,
                currency: currency,
                salaryMonthType: salaryMonthType,
                shiftHours: shiftHours,
                timezone: timezone,
                countryCode: countryCode
            } 

            if(!refId) {
                /** Create a new business */
                let business = await businessService.createBusinessForUser(req.user, businessObj);
            
                /** Update the user's name if passed */
                if(owner) {
                    await userService.updateUser({ name: owner }, req.user);
                }
                
                let data = {
                    refId: business.reference_id,
                    countryCode: business.country_code,
                    currency: business.currency,
                    shiftHours: business.shift_hours
                }
                return res.status(200).send({ code: "add_staff", message: "success", data: data });
            } else {
                /** Update the business */
                let updateCount = await businessService.updateBusiness(refId, businessObj);
                if(updateCount[0] === 0) {
                    return res.status(200).send({ code: "error", message: "business_not_found" });
                }
                return res.status(200).send({ code: "success", message: "success" });
            }

            
        } catch(err) {
            await logger.error("Exception in add business api: ", err);
            return res.status(200).send({ code: "error", message: "error" });
        }
    },

    fetchBusiness: async (req, res) => {
        try {
            let { refId } = req.query;

            let business = null;
            if(!refId) {
                /** Fetch the default business of the user */
                business = await userService.fetchDefaultBusinessForUser(req.user);
            } else {
                business = await businessService.fetchBusinessById(refId, true);
            }

            if(business === null) {
                return res.status(200).send({ code: "error", message: "business_not_found" });
            }

            let data = {
                "refId": business.reference_id,                                 
                "owner": business.user.name,                     
                "businessName": business.name,
                "currency": business.currency,
                "salaryMonthType": business.taxonomy.value,
                "shiftHours": business.shift_hours
            }

            return res.status(200).send({ code: "success", message: "success", data: data });
        } catch(err) {
            await logger.error("Exception in fetch business api: ", err);
            return res.status(200).send({ code: "error", message: "error" });
        }
    }
}