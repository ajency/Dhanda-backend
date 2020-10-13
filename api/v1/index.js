/** Express initialization */
const express = require("express");
const router = express.Router();
const passport = require("passport");

/** Controllers */
const defaultController = require("../../controllers/v1/defaultController");
const loginController = require("../../controllers/v1/loginController");
const businessController = require("../../controllers/v1/businessController");

/** API auth middleware */
require("../../config/apiAuth")

/** Open Routes */
router.get("/", defaultController.default);
router.post("/login/sendOtp", loginController.sendOtp);
router.post("/login/verifyOtp", loginController.verifyOtp);

/** API auth middleware */
require("../../config/apiAuth")

/** Protected Routes */
router.post("/addBusiness", passport.authenticate('jwt', { session: false }), businessController.addBusiness);

module.exports = router;
