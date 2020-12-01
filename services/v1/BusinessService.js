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
     *      phCountryCode: 91
     *      phone: "9876543210"
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
            country_code: businessObj.countryCode,
            ph_country_code: businessObj.phCountryCode,
            phone: businessObj.phone
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
     *      phCountryCode: 91
     *      phone: "9876543210"
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
            country_code: businessObj.countryCode,
            country: businessObj.country,
            ph_country_code: businessObj.phCountryCode,
            phone: businessObj.phone
        }
        return await models.business.update(saveBusinessObj, { where: { reference_id: refId }, returning: true });
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
        return await models.business.findAll({ where: { timezone: timezone }, include: [ { model: models.taxonomy } ] });
    }

    async createRoleInviteForUser(businessId, roleName, countryCode, phone, name, invitedByUserId) {
        /** Fetch the role */
        let role = await models.role.findOne({ where: { name: roleName } });
        return await models.business_user_role_invite.create({
            reference_id: "INV" + helperService.generateReferenceId(),
            business_id: businessId,
            role_id: (role) ? role.id : null,
            country_code: countryCode,
            phone: phone,
            name: name,
            deleted: false,
            invited_by: invitedByUserId
        });
    }

    async fetchRoleInvitesFor(roleName, businessId = null, countryCode = null, phone = null) {
        let role = await models.role.findOne({ where: { name: roleName } });
        if(!role) {
            return [];
        }
        
        let whereClause = {
            role_id: role.id,
            deleted: false,
            accepted: null
        };
        if(businessId) {
            whereClause.business_id = businessId;
        }
        if(countryCode) {
            whereClause.country_code = countryCode;
        }
        if(phone) {
            whereClause.phone = phone;
        }

        return await models.business_user_role_invite.findAll({ where: whereClause, 
            include: [ { model: models.business, as: "business" },
                { model: models.user, as: "invitedBy" } ] });
    }

    async fetchAdminListForBusiness(business, isObj = false) {
        let adminList = [];

        if(!isObj) {
            business = this.fetchBusinessById(business)
        }

        /** Add the owner to the list */
        adminList.push({
            name: business.user.name,
            countryCode: business.user.country_code,
            phone: business.user.phone,
            owner: true,
            invited: false,
            inviteRefId: null,
            adminRefId: business.user.reference_id
        });

        /** Fetch the admins */
        let roleUsers = await this.fetchBusUserRoleByRoleForBusiness("business_admin", business.id);
        for(let roleUser of roleUsers) {
            adminList.push({
                name: roleUser.user.name,
                countryCode: roleUser.user.country_code,
                phone: roleUser.user.phone,
                owner: false,
                invited: false,
                inviteRefId: null,
                adminRefId: roleUser.user.reference_id
            });
        }

        /** Fetch the invited numbers */
        let roleInvites = await this.fetchRoleInvitesFor("business_admin", business.id);

        for(let roleInvite of roleInvites) {
            adminList.push({
                name: roleInvite.name,
                countryCode: roleInvite.country_code,
                phone: roleInvite.phone,
                owner: false,
                invited: true,
                inviteRefId: roleInvite.reference_id
            });
        }

        return adminList;
    }

    async fetchBusUserRoleByRoleForBusiness(roleName, businessId = null, userId = null) {
        let role = await models.role.findOne({ where: { name: roleName } });
        if(!role) {
            return [];
        }
        let whereClause = {
            role_id: role.id,
            deleted: false
        }
        if(businessId) {
            whereClause.business_id = businessId;
        }
        if(userId) {
            whereClause.user_id = userId;
        }

        return await models.business_user_role.findAll({ where: whereClause, include: [ { model: models.user, as: "user" },
            { model: models.business, as: "business" } ] });
    }

    async fetchBusinessRoleInviteById(id, isRef = false) {
        let whereClause = {};
        if(isRef) {
            whereClause = { reference_id: id };
        } else {
            whereClause = { id: id };
        }
        return await models.business_user_role_invite.findOne({ where: whereClause, 
            include: [ { model: models.role, as: "role" },
                { model: models.business, as: "business" } ] });
    }

    async createBusinessUserRole(businessId, userId, roleId) {
        return await models.business_user_role.create({
            business_id: businessId,
            user_id: userId,
            role_id: roleId,
            deleted: false
        });
    }

    async isUserAdmin(userId, businessId, isBusinessRefId = false) {
        let business = await this.fetchBusinessById(businessId, isBusinessRefId);

        /** Check if the user is the owner */
        if(business.user_id === userId) {
            return true;
        } else {
            /** Fetch the admin list */
            let adminList = await this.fetchBusUserRoleByRoleForBusiness("business_admin", business.id);
            for(let admin of adminList) {
                if(admin.user_id === userId) {
                    return true;
                }
            }
            return false;
        }
    }
}