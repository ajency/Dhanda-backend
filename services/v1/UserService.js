const models = require("../../models");

module.exports = class UserService {
    async fetchUserByPhone(countryCode, phone) {
        let user = await models.user.findOne({ country_code: countryCode, phone: phone });
        return user;
    }

    async createUser(countryCode, phone, lang) {
        let user = await models.user.create({
            countryCode: countryCode,
            phone: phone,
            lang: lang
        });
        return user;
    }
}