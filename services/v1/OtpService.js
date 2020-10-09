const logger = require("simple-node-logger").createSimpleLogger({ timestampFormat:'YYYY-MM-DD HH:mm:ss.SSS' });
const defaults = require("../defaults");
const CryptrMod = require("cryptr");
const models = require("../../models");
const moment = require("moment");

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
        let message = `<#> ` + otp + ` is the OTP to verify your number with Dhanda App. Valid till ` 
            + moment().add(defaults.getValue("otp").expiry_sec, "seconds").format("HH:mm:ss") + ". " + process.env.APP_HASH;

        /** Send the sms */
        // TODO: integrate with sms service once available, add whitelisted 
        
        // TODO: Remove this later
        await logger.info("Sending this to " + phone + " : " + message);

        /** Send an email if in sandbox mode */
        if(process.env.OTP_SANDBOX === 'true') {
            // TODO: send email via SES
        }
    }

    async getLastValidOtp(phone, otpType) {
        /** Fetch the latest OTP for this phone */
        let otpEntry = await models.otp.findOne({ where: { phone: phone, otp_type: otpType },
            order: [ ['createdAt', 'DESC'] ] });

        if(otpEntry === null) {
            return null;
        } else {
            /** Check if the otp has expiried */
            let expirySec = defaults.getValue("otp").expiry_sec;
            if(moment().diff(moment(otpEntry.created_at), 'seconds') >= expirySec) {
                return null;
            }

            /** Check if the otp is valid */
            if(otpEntry.invalid) {
                return null;
            }

            await logger.info("Valid otp exists.");
            let cryptr = new CryptrMod(process.env.CRYPTR_KEY);
            return cryptr.decrypt(otpEntry.otp);
        }
    }
}