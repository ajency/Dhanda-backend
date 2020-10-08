const logger = require("simple-node-logger").createSimpleLogger({ timestampFormat:'YYYY-MM-DD HH:mm:ss.SSS' });
const defaults = require("../defaults");
const CryptrMod = require("cryptr");

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
            otpType: otpType
        });
    }
}