const JWTStrategy = require("passport-jwt").Strategy;
const ExtractJWT = require("passport-jwt").ExtractJwt;
const passport = require("passport");
const models = require("../models");
const b64 = require("base64url");

/** Passport middleware */
passport.use(new JWTStrategy({
    secretOrKey: process.env.JWT_SECRET,
    jwtFromRequest: ExtractJWT.fromAuthHeaderAsBearerToken()
}, async (payload, done) => {
    try {
        let authToken = await models.auth_token.findOne({ where: {token_id: b64.encode(JSON.stringify(payload))} });

        /** Check verify if this token was generated */
        if(authToken === null) {
            console.log("User not found.");
            return done(null, false);
        }

        /** Verify if the token is valid */
        if(authToken.get("invalid")) {
            console.log("Invalid token.")
            return done(null, false);
        }
        if(new Date(authToken.get("valid_till")) < new Date()) {
            console.log("Token expired.")
            return done(null, false, {message: "Token expired."});
        }

        /** Passing the user id instead of the user obj to avoid db call */
        return done(null, authToken.get("user_id"));
      } catch (error) {
        done(error);
      }
}));