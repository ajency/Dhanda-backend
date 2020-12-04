const logger = require("simple-node-logger").createSimpleLogger({ timestampFormat:'YYYY-MM-DD HH:mm:ss.SSS' });
const otpService = new (require("../../services/v1/OtpService"));
const userService = new (require("../../services/v1/UserService"));
const authService = new (require("../../services/AuthService"));
const ormService = new (require("../../services/OrmService"));
const ruleService = new (require("../../services/v1/RuleService"));
const businessService = new (require("../../services/v1/BusinessService"));
const moment = require("moment");

module.exports = {
    sendOtp: async (req, res) => {
        try {
            let { countryCode, phone, type } = req.body;
            
            /** Check if the phone is a user or the phone is an invitee if the type is login */
            if(type === "login") {
                let user = await userService.fetchUserByPhone(countryCode, phone)
                if(!user) {
                    let invites = await businessService.fetchRoleInvitesFor("business_admin", null, countryCode, phone);
                    if(invites.length === 0) {
                        await logger.info("Send otp - Not a user or business admin invitee. countryCode: " + countryCode
                            + " phone: " + phone);
                        return res.status(200).send({ code: "error", message: "no_user" });
                    }
                }
            }

            let resp = await otpService.generateAndSendOtpWrapper(countryCode, phone, type);
            return res.status(200).send(resp);
        } catch(err) {
            await logger.error("Exception in send otp api: ", err);
            return res.status(200).send({ code: "error", message: "error" });
        }
    },

    verifyOtp: async (req, res) => {
        try {
            let { countryCode, phone, lang, type, businessRefId } = req.body;
            let enteredOtp = req.body.otp;

            /** Fetch the latest OTP */
            let { otp, otpMsgCode, otpObj } = await otpService.getLastValidOtpAndCount(countryCode, phone, type);

            if(otp === null) {
                if(otpMsgCode === "no_otp") {
                    await logger.info("Verify otp - generate otp");
                    return res.status(200).send({ code: "error", message: "generate_otp" });
                }
                else if(otpMsgCode === "otp_expired") {
                    await logger.info("Verify otp - otp expired");
                    return res.status(200).send({ code: "error", message: "otp_expired" });
                }
                else if(otpMsgCode === "otp_invalid") {
                    await logger.info("Verify otp - invalid otp");
                    return res.status(200).send({ code: "error", message: "otp_invalid" });
                }
            }

            /** Verify the otp */
            let { verified, verifyMsgCode } = await otpService.verfyOtp(enteredOtp, otpObj, otp);
            if(!verified) {
                if(verifyMsgCode === "max_attempts") {
                    await logger.info("Verify otp - max attempts for otp done");
                    return res.status(200).send({ code: "error", message: "max_attempts" });
                }
                else if(verifyMsgCode === "incorrect_otp") {
                    await logger.info("Verify otp - incorrect otp");
                    return res.status(200).send({ code: "error", message: "incorrect_otp" });
                }
            }

            let code = "";
            let data = {};

            if(type === "login") {
                /** Check if the user exists */
                let user = await userService.fetchUserByPhone(countryCode, phone);
                
                /** Create a new user if not present */
                if(user === null) {
                    user = await userService.createUser(countryCode, phone, lang);
                    /** Set verified to true */
                    await ormService.updateModel("user", user.id, { verified: true });
                    // code = "business_details";
                } /*else {
                    // code = "home";
                }*/

                /** Update the users last login */
                ormService.updateModel("user", user.id, { last_login: new Date() });

                /** Check if we need to force verification */
                if(!user.verified) {
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

                /** Generate access token */
                let token = await authService.generateTokenForUser(user, true);
                
                data = {
                    token: token,
                    lang: user.lang
                };

                let postLoginObj = await userService.fetchPostLoginCodeForUserByToken("Bearer " + token);
                code = postLoginObj.code;
                if(postLoginObj.hasOwnProperty("data")) {
                    data = { ...data, ...postLoginObj.data }
                }
            } else if(type === "verify_user") {
                let result = await userService.updateUserPhone(businessRefId);
                if(result.code === "error") {
                    return res.status(200).send(result);
                }
                code = "home";
            }

            return res.status(200).send({ code: code, message: "success", data: data });
        } catch(err) {
            await logger.error("Exception in verify otp api: ", err);
            return res.status(200).send({ code: "error", message: "error" });
        }
    },

    logout: async (req, res) => {
        try {
            /** Invalidate the token */
            let token = req.headers.authorization;
            await authService.invalidateToken(token);
            return res.status(200).send({ code: "success", message: "success" });
        } catch(err) {
            await logger.error("Exception in logout api: ", err);
            return res.status(200).send({ code: "error", message: "error" });
        }
    }
}