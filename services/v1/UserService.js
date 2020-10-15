const models = require("../../models");
const helperService = new (require("../HelperService"));
const jwt = require("jsonwebtoken");

module.exports = class UserService {
    async fetchUserByPhone(countryCode, phone) {
        let user = await models.user.findOne({ where: { country_code: countryCode, phone: phone } });
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
                    { model: models.business, include: [ { model: models.staff } ] }
                ] });

            /** If no user is found */
            if(!user) {
                return { code: "login" };
            }

            /** If there are no businesses */
            if(user.businesses.length === 0) {
                return { code: "add_business" };
            }

            /** Check if the default business has staff added to it */
            for(let business of user.businesses) {
                if(business.default && business.staffs.length === 0) {
                    return { code: "add_staff", data: { businessRefId: business.reference_id } };
                }
            }

            return { code: "home" };
        } catch(err) {
            await logger.info("Error while finding post login code by token: ", err); // for debugging in the future
            return { code: "login" };
        }
    }
}