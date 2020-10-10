const jwt = require("jsonwebtoken");
const models = require("../models");
const b64 = require("base64url");
const defaults = require("./defaults");
const moment = require('moment');
const logger = require("simple-node-logger").createSimpleLogger({ timestampFormat:'YYYY-MM-DD HH:mm:ss.SSS' });

module.exports = class AuthService {
    /**
     * Params:
     * user             can be an id or an object
     * userIsObject     default false, should be sent as true if 'user' is
     *                  the user object
     */
    async generateTokenForUser(user, userIsObject = false) {
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
            const token = jwt.sign({user: payload}, process.env.JWT_SECRET);

            /** Update the token into the DB */
            let validTill = moment().add(defaults.getValue('token_expiry_mins'), "minutes").format("YYYY/MM/DD HH:mm:ss");

            let userAuthToken = {
                token_id: b64.encode(JSON.stringify(jwt.verify(token, process.env.JWT_SECRET))),
                user_id: user.get("id"),
                type: "app",
                invalid: false,
                valid_till: validTill
            };
            await models.auth_token.create(userAuthToken);

            return token;
        } catch(e) {
            await logger.info("Error while generating token: ", e);
            return null;
        }
    }
}