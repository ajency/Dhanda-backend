const models = require("../../models");
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const helperService = new (require("../HelperService"));
const jwt = require("jsonwebtoken");
const businessService = new (require("./BusinessService"));
const logger = require("simple-node-logger").createSimpleLogger({ timestampFormat:'YYYY-MM-DD HH:mm:ss.SSS' });

module.exports = class UserService {
    async fetchUserByPhone(countryCode, phone) {
        let user = await models.user.findOne({ where: { country_code: countryCode, phone: phone } });
        return user;
    }

    async fetchUserAndBusinessAdminByPhone(countryCode, phone) {
        let user = await models.user.findOne({ where: { country_code: countryCode, phone: phone },
            include: [ { model: models.business, as: "businesses" },
                { separate: true, model: models.business_user_role, as: "businessUserRoles", 
                    where: { deleted: false },
                    include: [ { model: models.role, as: "role", where: { name: "business_admin" } } ] }
            ] } );
        return user;
    }

    async createUser(countryCode, phone, lang) {
        let user = await models.user.create({
            reference_id: "U" + helperService.generateReferenceId(),
            country_code: countryCode,
            phone: phone,
            lang: lang
        });
        return user;
    }

    async updateUser(attributes, userId) {
        await models.user.update(attributes, { where: { id: userId } });
    }

    async fetchDefaultBusinessForUser(userId) {
        let business = await models.business.findOne({ where: { user_id: userId, default: true },
            include: [ { model: models.user }, { model: models.taxonomy } ] });
        return business;
    }
    
    async fetchPostLoginCodeForUserByToken(token) {
        /** When the token is not passed */
        if(!token) {
            return { code: "login" };
        }

        /** Extract the reference id */
        let jwtToken = token.split(' ')[1];
        try {
            let payload = jwt.verify(jwtToken, process.env.JWT_SECRET);
            
            /** Fetch the user details based on the reference id */
            let user = await models.user.findOne({ where: { reference_id: payload.user.refId },
                include: [
                    { model: models.business, as: "businesses", include: [ { model: models.staff } ] }
                ] });

            /** If no user is found */
            if(!user) {
                return { code: "login" };
            }

            /** Check if this user is an admin of any business */
            let businessUserRoleEntries = await businessService.fetchBusUserRoleByRoleForBusiness("business_admin", null, user.id);
            if(businessUserRoleEntries.length > 0) {
                return { code: "home", data: { 
                    businessRefId: businessUserRoleEntries[0].business.reference_id,
                    businessName: businessUserRoleEntries[0].business.name,
                    currency: businessUserRoleEntries[0].business.currency,
                    countryCode: businessUserRoleEntries[0].business.country_code,
                    shiftHours: businessUserRoleEntries[0].business.shift_hours
                } };
            }

            /** Check if this user is invited to any business */
            let userInvites = await businessService.fetchRoleInvitesFor("business_admin", null, user.country_code, user.phone);
            if(userInvites.length > 0) {
                return { code: "business_invite", data: { 
                    inviterBusinessName: userInvites[0].business.name,
                    inviterName: userInvites[0].invitedBy.name,
                    inviteRefId: userInvites[0].reference_id
                } };
            }

            /** If there are no businesses */
            if(user.businesses.length === 0) {
                return { code: "add_business" };
            }

            /** Check if the default business has staff added to it */
            let defaultBusiness = null;
            for(let business of user.businesses) {
                if(business.default) {
                    defaultBusiness = business;
                }
                if(business.default && business.staffs.length === 0) {
                    return { code: "add_staff", data: { 
                        businessRefId: business.reference_id,
                        businessName: business.name,
                        currency: business.currency,
                        countryCode: business.country_code,
                        shiftHours: business.shift_hours
                    } };
                }
            }

            return { code: "home", data: { 
                businessRefId: defaultBusiness.reference_id,
                businessName: defaultBusiness.name,
                currency: defaultBusiness.currency,
                countryCode: defaultBusiness.country_code,
                shiftHours: defaultBusiness.shift_hours
            } };
        } catch(err) {
            await logger.info("Error while finding post login code by token: ", err); // for debugging in the future
            return { code: "login" };
        }
    }
}