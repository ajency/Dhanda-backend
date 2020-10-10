const logger = require("simple-node-logger").createSimpleLogger({ timestampFormat:'YYYY-MM-DD HH:mm:ss.SSS' });
const otpService = new (require("../../services/v1/OtpService"));
const userService = new (require("../../services/v1/UserService"));
const authService = new (require("../../services/AuthService"));

module.exports = {
    sendOtp: async (req, res) => {
        try {
            let { phone } = req.body;

            /** Check if there is a valid OTP already present */
            let { otp, otpCount } = await otpService.getLastValidOtpAndCount(phone, "login");

            /** Check if max tries have been exceeded */
            let canGenerateOtp = await otpService.canGenerateOtp(otpCount);
            if(!canGenerateOtp) {
                return res.status(200).send({ code: "error", message: "otp_limit_reached" });
            }


            /** Generate the OTP if not already present */
            if(otp === null) {
                otp = await otpService.generateOtp();
            }

            if(process.env.OTP_SANDBOX && process.env.OTP_SANDBOX === "true") {
                await logger.info("OTP for " + phone + " is " + otp);
            }
            
            /** Save OTP */
            await otpService.saveOtp(phone, otp, "login");

            /** Send OTP */
            await otpService.sendOtp(phone, otp);

            res.status(200).send({ code: "verify_otp", message: "success" });
        } catch(err) {
            await logger.error("Exception in send otp api: ", err);
            res.status(200).send({ code: "error", message: "error" });
        }
    },

    verifyOtp: async (req, res) => {
        try {
            let { countryCode, phone, lang } = req.body;
            let enteredOtp = req.body.otp;

            /** Fetch the latest OTP */
            let { otp, otpMsgCode, otpObj } = await otpService.getLastValidOtpAndCount(phone, "login");

            if(otp === null) {
                if(otpMsgCode === "no_otp")
                    return res.status(200).send({ code: "error", message: "generate_otp" });
                else if(otpMsgCode === "otp_expired")
                    return res.status(200).send({ code: "error", message: "otp_expired" });
                else if(otpMsgCode === "otp_invalid")
                    return res.status(200).send({ code: "error", message: "otp_invalid" });
            }

            /** Verify the otp */
            let { verified, verifyMsgCode } = await otpService.verfyOtp(enteredOtp, otpObj, otp);
            if(!verified) {
                if(verifyMsgCode === "max_attempts")
                    return res.status(200).send({ code: "error", message: "max_attempts" });
                else if(verifyMsgCode === "incorrect_otp")
                    return res.status(200).send({ code: "error", message: "incorrect_otp" });
            }

            /** Check if the user exists */
            let user = await userService.fetchUserByPhone(countryCode, phone);

            /** Create a new user if not present */
            if(user === null) {
                user = await userService.createUser(countryCode, phone, lang);
                code = "business_details";
            } else {
                code = "home";
            }

            /** Generate access token */
            let token = await authService.generateTokenForUser(user, true);
            
            let data = {
                token: token,
                lang: user.lang
            };

            return res.status(200).send({ code: code, message: "success", data: data });
        } catch(err) {
            await logger.error("Exception in verify otp api: ", err);
            res.status(200).send({ code: "error", message: "error" });
        }
    }
}