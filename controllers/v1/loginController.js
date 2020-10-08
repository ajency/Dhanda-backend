const models = require("../../models");

const otpService = new (require('../../services/v1/OtpService'));

module.exports = {
    sendOtp: async (req, res) => {
        let { phone } = req.body;

        /** Generate the OTP */
        let otp = await otpService.generateOtp();
        if(process.env.OTP_SANDBOX && process.env.OTP_SANDBOX === "true") {
            await logger.info("OTP for " + phone + " is " + otp);
        }
        
        /** Save OTP */
        await otpService.saveOtp(phone, otp, "login");

        res.status(200).send("Test");
    }
}