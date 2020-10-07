const jwt = require("jsonwebtoken");
const models = require("../models");
const b64 = require("base64url");
const defaults = require("./defaults");
var moment = require('moment');

module.exports = {
    /**
     * Params:
     * user             can be an id or an object
     * type             web, app
     * userIsObject     default false, should be sent as true if 'user' is
     *                  the user object
     */
    generateTokenForUser: async (user, type, userIsObject = false) => {
        try {
            /** Fetch the user information */
            if(!userIsObject) {
                /** Fetch the user by id */
                user = await models.user.findOne({ where: { id: user } });
            }

            /** Generate the payload */
            const payload  = {
                refId: user.get("reference_id")
            }
            const token = jwt.sign({user: payload}, "admin123");

            /** Update the token into the DB */
            let validTill = moment().format("YYYY/MM/DD HH:mm:ss");
            if(type === "app") {
                validTill = moment().add(defaults.getValue('appTokenExpiry'), "minutes").format("YYYY/MM/DD HH:mm:ss");
            } else {
                validTill = moment().add(defaults.getValue('webTokenExpiry'), "minutes").format("YYYY/MM/DD HH:mm:ss");
            }
            let userAuthToken = {
                token_id: b64.encode(JSON.stringify(jwt.verify(token, "admin123"))),
                user_id: user.get("id"),
                type: type,
                invalid: false,
                valid_till: validTill
            };
            await models.auth_token.create(userAuthToken);

            return token;
        } catch(e) {
            console.log("Error while generating token:", e);
            return null;
        }
    }
}