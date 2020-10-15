const models = require("../../models");
const helperService = new (require("../HelperService"));

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
}