const logger = require("simple-node-logger").createSimpleLogger({ timestampFormat:'YYYY-MM-DD HH:mm:ss.SSS' });
const defaults = require("../defaults");
const CryptrMod = require("cryptr");
const models = require("../../models");
const moment = require("moment");
const Sequelize = require('sequelize');
const Op = Sequelize.Op;

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

    async getLastValidOtpAndCount(phone, otpType) {
        /** Fetch the latest OTP for this phone */
        let otps = await models.otp.findAll({ where: { 
            phone: phone, otp_type: otpType, created_at: {
                [Op.between]: [ moment().subtract(1,"days"), moment() ]
            }},
            order: [ ['createdAt', 'DESC'] ] });

        if(otps === null || otps.length === 0) {
            return { otp: null, otpCount: 0, otpMsgCode: "no_otp", otpObj: null };
        } else {
            /** Check if the otp has expiried */
            let expirySec = defaults.getValue("otp").expiry_sec;
            if(moment().diff(moment(otps[0].created_at), 'seconds') >= expirySec) {
                return { otp: null, otpCount: otps.length, otpMsgCode: "otp_expired", otpObj: otps[0] };
            }

            /** Check if the otp is valid */
            if(otps[0].invalid) {
                return { otp: null, otpCount: otps.length, otpMsgCode: "otp_invalid", otpObj: otps[0] };
            }

            await logger.info("Valid otp exists.");
            let cryptr = new CryptrMod(process.env.CRYPTR_KEY);
            return { otp: cryptr.decrypt(otps[0].otp), otpCount: otps.length, otpMsgCode: "otp_returned", otpObj: otps[0] };
        }
    }

    async canGenerateOtp(countOfOtps) {
        let maxAllowed = defaults.getValue("otp").max_allowed;
        if(countOfOtps < maxAllowed) {
            return true;
        } else {
            return false;
        }
    }

    async verfyOtp(otp, otpObj, decodedOtp = null) {
        /** Decode otp from otpObj is not passed */
        if(decodedOtp === null) {
            let cryptr = new CryptrMod(process.env.CRYPTR_KEY);
            decodedOtp = cryptr.decrypt(otpObj.otp);
        }

        /** Check if the otp matches */
        if(otp === decodedOtp) {
            return { verified: true, verifyMsgCode: "verified" };
        } else {
            /** Increment the count */
            let attempts = otpObj.attempts;
            let maxAttempts = defaults.getValue("otp").max_attempts;
            
            if(attempts >= maxAttempts) {
                return { verified: false, verifyMsgCode: "max_attempts" }
            } else {
                attempts += 1;
                otpObj.attempts = attempts;
                await models.otp.update(otpObj);

                if(attempts >= maxAttempts) {
                    return { verified: false, verifyMsgCode: "max_attempts" }
                } else {
                    return { verified: false, verifyMsgCode: "incorrect_otp" }
                }
            }
        }

    }
}