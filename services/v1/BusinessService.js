const logger = require("simple-node-logger").createSimpleLogger({ timestampFormat:'YYYY-MM-DD HH:mm:ss.SSS' });
const defaults = require("../defaults");
const models = require("../../models");
const moment = require("moment");
const helperService = new (require("../HelperService"));
const taxonomyService = new (require("./TaxonomyService"));
const ormService = new (require("../OrmService"));

module.exports = class BusinessService {
    /**
     * Expected businessObj = {
     *      name: businessName,
     *      currency: currency,
     *      salaryMonthType: salaryMonthType,
     *      shiftHours: shiftHours,
     *      timezone: timezone,
     *      countryCode: countryCode
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
        let salaryMonthTaxonomy = await taxonomyService.findTaxonomy("business_salary_month", businessObj.salaryMonthType);

        return await models.business.create({
            reference_id: "B" + helperService.generateReferenceId(),
            name: businessObj.name,
            currency: businessObj.currency,
            salary_month_txid: salaryMonthTaxonomy.id,
            shift_hours: businessObj.shiftHours ? businessObj.shiftHours : null,
            user_id: userId,
            default: def,
            active: true,
            timezone: businessObj.timezone,
            country_code: businessObj.countryCode
        });
    }

    /**
     * * Expected businessObj = {
     *      name: businessName,
     *      currency: currency,
     *      salaryMonthType: salaryMonthType,
     *      shiftHours: shiftHours,
     *      timezone: timezone,
     *      countryCode: countryCode
     * }
     * @param {*} refId 
     * @param {*} businessObj 
     */
    async updateBusiness(refId, businessObj) {
        /** Find the salary_month_txid */
        let salaryMonthTaxonomy = await models.taxonomy.findOne({ where: { type: "business_salary_month",
            value: businessObj.salaryMonthType } });
        
        let saveBusinessObj = {
            name: businessObj.name,
            currency: businessObj.currency,
            salary_month_txid: salaryMonthTaxonomy.id,
            shift_hours: businessObj.shiftHours ? businessObj.shiftHours : null,
            timezone: businessObj.timezone,
            country_code: businessObj.countryCode
        }
        return await models.business.update(saveBusinessObj, { where: { reference_id: refId } });
    }

    async fetchBusinessById(businessId, isRefId = false) {
        if(isRefId) {
            return await models.business.findOne({ where: { reference_id: businessId },
                include: [ { model: models.user }, { model: models.taxonomy } ] });
        } else {
            return await models.business.findOne({ where: { id: businessId },
                include: [ { model: models.user }, { model: models.taxonomy } ] });
        }
    }

    async fetchDistinctBusinessTimezones() {
        return await ormService.runRawSelectQuery("select distinct timezone from businesses where timezone is not null");
    }

    async fetchBusinessByTimezone(timezone) {
        return await models.business.findAll({ where: { timezone: timezone } });
    }

    async createRoleInviteForUser(businessId, roleName, countryCode, phone, name) {
        /** Fetch the role */
        let role = await models.role.findOne({ where: { name: roleName } });
        return await models.business_user_role_invite.create({
            reference_id: "INV" + helperService.generateReferenceId(),
            business_id: businessId,
            role_id: (role) ? role.id : null,
            country_code: countryCode,
            phone: phone,
            name: name,
            deleted: false
        });
    }

    async fetchRoleInvitesForUser(businessId, roleName, countryCode, phone) {
        let role = await models.role.findOne({ where: { name: roleName } });
        let whereClause = {
            role_id: role.id,
            country_code: countryCode,
            phone: phone
        };
        if(businessId) {
            whereClause.business_id = businessId;
        }
        if(!role) {
            return [];
        }
        return await models.business_user_role_invite.findAll({ where: whereClause });
    }
}