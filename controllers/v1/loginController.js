const logger = require("simple-node-logger").createSimpleLogger({ timestampFormat:'YYYY-MM-DD HH:mm:ss.SSS' });
const otpService = new (require('../../services/v1/OtpService'));

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

            res.status(200).send({ code: "success", message: "success" });
        } catch(err) {
            await logger.error("Exception in send otp api: " + err);
            res.status(200).send({ code: "error", message: "error" });
        }
    }
}