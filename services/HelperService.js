const axios = require('axios');
const moment = require("moment");
const models = require("../models");

// const SMS_BASE_URL = process.env.SMS_BASE_URL;
// const SMS_USERNAME = process.env.SMS_USERNAME;
// const SMS_SENDER_ID = process.env.SMS_SENDER_ID;
// const SMS_AUTHKEY = process.env.SMS_AUTHKEY;

module.exports = class HelperService {
    
    roundedValueCalculate(number, fixed) {
        if(fixed == 0) {
            return Math.round(number + Number.EPSILON);
        } else if(fixed == 2) {
            return Math.round((number + Number.EPSILON) * 100) / 100;
        } else {
            return number;
        }
    }

    getOtp(n) {
    	var add = 1, max = 12 - add;
        max = Math.pow(10, n+add);
        var min = max/10;
        var number = Math.floor( Math.random() * (max - min + 1) ) + min;
        return ("" + number).substring(add);
    }

    sendSms(number, otp, expiry) {
    	// axios.get(SMS_BASE_URL+`/api/pushsms?user=`+SMS_USERNAME+`&authkey=`+SMS_AUTHKEY+`&sender=`+SMS_SENDER_ID+`&mobile=`+number+`&text=`+otp+` is the OTP to verify your number with Finaegis. It will expire in `+expiry+` minutes&rpt=1`).then(response => response.data)
        // .catch(error => {
        //     console.log(error)
        //     throw error
        // });
    }

    getCurrency(amount) {
        let amountArr = roundedValueCalculate(amount, 0).toString().split('.');
        let tempAmount = amountArr[0];
        let sign = '';
        if(tempAmount.substring(0,1) == '-') {
            sign = tempAmount.substring(0,1);
            tempAmount = tempAmount.substring(1);
        }
        let lastThree = tempAmount.substring(tempAmount.length-3);
        let otherNumbers = tempAmount.substring(0,tempAmount.length-3);
        if(otherNumbers != '') {
            lastThree = ',' + lastThree;
        }
        let decimals = '';
        if(amountArr.length > 1){
            decimals = '.' + amountArr[1];
        }
        return sign+(otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ","))+lastThree+decimals;
    }

    async getDefaultsValue(type) { 
        return await models.global_defaults.findOne({ where: { type: type } });
    }

    getFormattedCurrency(amount) {
        let amountArr = roundedValueCalculate(amount, 2).toString().split('.');
        let tempAmount = amountArr[0];
        let sign = '';
        if(tempAmount.substring(0,1) == '-') {
            sign = tempAmount.substring(0,1);
            tempAmount = tempAmount.substring(1);
        }
        let lastThree = tempAmount.substring(tempAmount.length-3);
        let otherNumbers = tempAmount.substring(0,tempAmount.length-3);
        if(otherNumbers != '') {
            lastThree = ',' + lastThree;
        }
        let decimals = '';
        if(amountArr.length > 1){
            decimals = '.' + amountArr[1];
        }
        return sign+(otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ","))+lastThree+decimals;
    }

    roundedValue(number, fixed) {
        return roundedValueCalculate(number, fixed);
    }

    validateRequiredRequestParams(req, requierdParams) {
        return requierdParams.every(key => Object.keys(req).includes(key));
    }

    generateReferenceId() {
        return Math.floor(Math.random() * 100)+''+new Date().getTime();
    }

    /**
     * 
     * @param {*} shiftHoursString  "10:00:00"
     */
    getHalfDayHours(shiftHoursString) {
        if(!shiftHoursString) {
            return "";
        }
        let shiftHoursExplode = shiftHoursString.split(":");

        let seconds = (shiftHoursExplode[0] * 60 * 60) + (shiftHoursExplode[1] * 60) + (shiftHoursExplode[2] * 1);
        seconds = Math.round(seconds / 2);

        /** Convert this to the shift hours string */
        return (("00" + Math.floor(seconds / (60 * 60))).slice(-2)) + ":" + (("00" + (Math.floor(seconds % (60 * 60) / 60))).slice(-2)) 
            + ":" + (("00" + (seconds % (60 * 60) % 60)).slice(-2));
    }
}