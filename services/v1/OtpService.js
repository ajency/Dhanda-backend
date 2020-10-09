const logger = require("simple-node-logger").createSimpleLogger({ timestampFormat:'YYYY-MM-DD HH:mm:ss.SSS' });
const defaults = require("../defaults");
const CryptrMod = require("cryptr");
const models = require("../../models");

module.exports = class OtpService {
    async generateOtp() {
        await logger.info("Generate OTP");

        /** Fetch the otp length */
        let otpLength = defaults.getValue("otp").length;

        /** Generate a random otp */
        let add = 1, max = 12 - add;
        max = Math.pow(10, otpLength + add);
        let min = max / 10;
        let number = Math.floor( Math.random() * (max - min + 1) ) + min;
        return ("" + number).substring(add);
    }

    async saveOtp(phone, otp, otpType) {  
        /** Encrypt the OTP */
        let cryptr = new CryptrMod(process.env.CRYPTR_KEY);
        let encOtp = cryptr.encrypt(otp);

        /** Save otp to DB */
        await models.otp.create({
            phone: phone,
            otp: encOtp,
            otp_type: otpType
        });
    }

    async sendOtp(phone, otp) {
        /** Generate OTP message with app hash */
        let message = `<%23> ` + otp + ` is the OTP to verify your number with Dhanda App. It will expire in `
            + defaults.getValue("otp").expiry; + ` minutes` + process.env.APP_HASH;

        /** Send the sms */
        // TODO: integrate with sms service once available, add whitelisted 
        
        // TODO: Remove this later
        await logger.info("Sending this to " + phone + " : " + message);

        /** Send an email if in sandbox mode */
        if(process.env.OTP_SANDBOX === 'true') {
            // TODO: send email via SES
        }
    }
}