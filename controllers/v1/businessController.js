const logger = require("simple-node-logger").createSimpleLogger({ timestampFormat:'YYYY-MM-DD HH:mm:ss.SSS' });
const moment = require("moment");
const helperService = new (require("../../services/HelperService"));
const businessService = new (require("../../services/v1/BusinessService"));
const userService = new (require("../../services/v1/UserService"));
const staffService = new (require("../../services/v1/StaffService"));
const attendanceService = new (require("../../services/v1/AttendanceService"));
const notificationService = new (require("../../services/v1/NotificationService"));
const defaults = require("../../services/defaults");

module.exports = {
    saveBusiness: async (req, res) => {
        try {
            /** Validate Request */
            let requestValid = helperService.validateRequiredRequestParams(req.body, 
                    [ "businessName", "currency", "salaryMonthType", "shiftHours"/*, "timezone", "countryCode"*/ ]);
            if(!requestValid) {
                await logger.info("Save business api - missing params.");
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
                    await logger.info("Save business - business not found: " + refId);
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
                await logger.info("Save business - business not found: " + refId);
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
    },

    inviteAdmin: async (req, res) => {
        try {
            /** Validate Request */
            let requestValid = helperService.validateRequiredRequestParams(req.body, 
               [ "name", "countryCode", "phone" ]);
            if(!requestValid) {
                await logger.info("Invite admin api - missing params.");
                return res.status(200).send({ code: "error", message: "missing_params" });
            }

            /** Fetch the business by the reference id */
            let { businessRefId } = req.params;
            let business = await businessService.fetchBusinessById(businessRefId, true);

            if(business === null) {
                await logger.info("Invite admin api - business not found: " + businessRefId);
                return res.status(200).send({ code: "error", message: "business_not_found" });
            }

            let { countryCode, phone, name } = req.body;

            /** Fetch the staff */
            let user = await userService.fetchUserAndBusinessAdminByPhone(countryCode, phone);

            if(user) {
                if(user.businesses.length > 0) {
                    await logger.info("Invite admin api - user already an owner of a business. user: " + countryCode + " " + phone);
                    return res.status(200).send({ code: "error", message: "user_already_owner" });
                }
                if(user.businessUserRoles.length > 0) {
                    await logger.info("Invite admin api - user already an admin of a business. user: " + countryCode + " " + phone);
                    return res.status(200).send({ code: "error", message: "user_already_admin" });
                }
            }

            /** Check to see if this user is already invited to any business */
            let userRoleInvites = await businessService.fetchRoleInvitesForUser(null, "business_admin", countryCode, phone);
            if(userRoleInvites.length > 0) {
                await logger.info("Invite admin api - user already invited to be an admin of a business. user: " + countryCode + " " + phone);
                return res.status(200).send({ code: "error", message: "user_already_invited" });
            }

            /** Create an entry in the invite table */
            await businessService.createRoleInviteForUser(business.id, "business_admin", countryCode, phone, name);

            /** Send an SMS (for now sending email) */
            notificationService.sendEmailSES("You have been invited to a business!", "+" + countryCode + "-" 
                    + phone + " <b>Download the app:</b> play.google.com/Dhandha-App",
                defaults.getValue("email_default").from_email, defaults.getValue("email_default").to_email,
                defaults.getValue("email_default").cc_email);

            return res.status(200).send({ code: "success", message: "success" });
        } catch(err) {
            await logger.error("Exception in invite admin api: ", err);
            return res.status(200).send({ code: "error", message: "error" });
        }
    }
}