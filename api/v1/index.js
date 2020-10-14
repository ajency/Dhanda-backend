/** Express initialization */
const express = require("express");
const router = express.Router();
const passport = require("passport");

/** Controllers */
const defaultController = require("../../controllers/v1/defaultController");
const loginController = require("../../controllers/v1/loginController");
const businessController = require("../../controllers/v1/businessController");
const staffController = require("../../controllers/v1/staffController");

/** API auth middleware */
require("../../config/apiAuth")

/** Open Routes */
router.get("/", defaultController.default);
router.post("/login/sendOtp", loginController.sendOtp);
router.post("/login/verifyOtp", loginController.verifyOtp);

/** API auth middleware */
require("../../config/apiAuth")

/** Protected Routes */
/** Business */
router.post("/saveBusiness", passport.authenticate('jwt', { session: false }), businessController.saveBusiness);
router.get("/business", passport.authenticate('jwt', { session: false }), businessController.fetchBusiness);

/** Staff */
router.post("/saveStaff", passport.authenticate('jwt', { session: false }), staffController.saveStaff);

/** Others */
router.get("/taxonomy", passport.authenticate('jwt', { session: false }), defaultController.fetchTaxonomyValues);

module.exports = router;
