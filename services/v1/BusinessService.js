const logger = require("simple-node-logger").createSimpleLogger({ timestampFormat:'YYYY-MM-DD HH:mm:ss.SSS' });
const defaults = require("../defaults");
const models = require("../../models");
const moment = require("moment");
const helperService = new (require("../HelperService"));

module.exports = class BusinessService {
    /**
     * Expected businessObj = {
     *      name: businessName,
     *      currency: currency,
     *      salaryMonthType: salaryMonthType,
     *      shiftHours: shiftHours
     * }
     * @param {*} userId 
     * @param {*} businessObj 
     */
    async createBusinessForUser(userId, businessObj) {
        let def = true;

        /** Fetch the bussiness for the user */
        let userBusinesses = await models.business.findAll({ where: { user_id: userId } });
        if(userBusinesses.length > 0) {
            def = false;
        }

        /** Find the salary_month_txid */
        let salaryMonthTaxonomy = await models.taxonomy.findOne({ where: { type: "business_salary_month",
            value: businessObj.salaryMonthType } });

        return await models.business.create({
            reference_id: "B" + helperService.generateReferenceId(),
            name: businessObj.name,
            currency: businessObj.currency,
            salary_month_txid: salaryMonthTaxonomy.id,
            shift_hours: businessObj.shiftHours,
            user_id: userId,
            default: def,
            active: true,
        });
    }
}