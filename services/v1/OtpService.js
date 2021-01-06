const logger = require("simple-node-logger").createSimpleLogger({ timestampFormat:'YYYY-MM-DD HH:mm:ss.SSS' });
const defaults = require("../defaults");
const CryptrMod = require("cryptr");
const models = require("../../models");
const moment = require("moment");
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const notificationService = new (require("../../services/v1/NotificationService"));

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

    async saveOtp(countryCode, phone, otp, otpType) {  
        /** Encrypt the OTP */
        let cryptr = new CryptrMod(process.env.CRYPTR_KEY);
        let encOtp = cryptr.encrypt(otp);

        /** Save otp to DB */
        await models.otp.create({
            country_code: countryCode,
            phone: phone,
            otp: encOtp,
            otp_type: otpType
        });
    }

    async sendOtp(countryCode, phone, otp) {
        /** Generate OTP message with app hash */
        let message = `<#> ` + otp + ` is the OTP to verify your number with Dhanda App. Valid till ` 
            + moment().add(defaults.getValue("otp").expiry_sec, "seconds").format("HH:mm:ss") + ". " + process.env.APP_HASH;

        /** Send the sms */
        // TODO: integrate with sms service once available
        // TODO: send to only whitelisted number if in sandbox mode
        
        // TODO: Remove this later
        await logger.info("Sending this to " + phone + " : " + message);

        /** Send an email if in sandbox mode */
        if(process.env.OTP_SANDBOX === 'true') {
            await logger.info("OTP sandbox active. Sending otp to " + defaults.getValue("email_default").to_email);
            /** Send the email asynchronously */
            notificationService.sendEmailSES("DhandaApp Login OTP", "<b>Phone:</b> " + phone + " <br/><b>Message:</b> " + message,
                defaults.getValue("email_default").from_email, defaults.getValue("email_default").to_email,
                defaults.getValue("email_default").cc_email);
        }
    }

    async getLastValidOtpAndCount(countryCode, phone, otpType) {
        /** Fetch the latest OTP for this phone */
        let otps = await models.otp.findAll({ where: { 
            country_code: countryCode, phone: phone, otp_type: otpType, created_at: {
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
                await models.otp.update({ attempts: attempts }, { where: { id: otpObj.id }});

                if(attempts >= maxAttempts) {
                    return { verified: false, verifyMsgCode: "max_attempts" }
                } else {
                    return { verified: false, verifyMsgCode: "incorrect_otp" }
                }
            }
        }

    }

    async generateAndSendOtpWrapper(countryCode, phone, type) {
        /** Check if there is a valid OTP already present */
        let { otp, otpCount } = await this.getLastValidOtpAndCount(countryCode, phone, type);

        /** Check if max tries have been exceeded */
        let canGenerateOtp = await this.canGenerateOtp(otpCount);
        if(!canGenerateOtp) {
            await logger.info("Send otp - otp limit reached");
            return { code: "error", message: "otp_limit_reached" };
        }


        /** Generate the OTP if not already present */
        if(otp === null) {
            otp = await this.generateOtp();
        }

        if(process.env.OTP_SANDBOX && process.env.OTP_SANDBOX === "true") {
            await logger.info("OTP for " + phone + " is " + otp);
        }
        
        /** Save OTP */
        await this.saveOtp(countryCode, phone, otp, type);

        /** Send OTP */
        await this.sendOtp(countryCode, phone, otp);

        return { code: "verify_otp", message: "success" };
    }
}