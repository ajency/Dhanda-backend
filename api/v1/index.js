/** Express initialization */
const express = require("express");
const router = express.Router();
const passport = require("passport");

/** Controllers */
const defaultController = require("../../controllers/v1/defaultController");
const loginController = require("../../controllers/v1/loginController");
const businessController = require("../../controllers/v1/businessController");
const staffController = require("../../controllers/v1/staffController");
const attendanceController = require("../../controllers/v1/attendanceController");

/** API auth middleware */
require("../../config/apiAuth")

/** Open Routes */
router.get("/", defaultController.default);
router.post("/login/sendOtp", loginController.sendOtp);
router.post("/login/verifyOtp", loginController.verifyOtp);
router.get("/init", defaultController.coldStart);

/** Protected Routes */
/** Business */
router.post("/saveBusiness", passport.authenticate('jwt', { session: false }), businessController.saveBusiness);
router.get("/business", passport.authenticate('jwt', { session: false }), businessController.fetchBusiness);

/** Attendance */
router.get("/business/:businessRefId/attendance", passport.authenticate('jwt', { session: false }), attendanceController.fetchStaffAttendance);

/** Staff */
router.post("/saveStaff", passport.authenticate('jwt', { session: false }), staffController.saveStaff);
router.get("/staff", passport.authenticate('jwt', { session: false }), staffController.fetchStaff);

/** Others */
router.get("/taxonomy", passport.authenticate('jwt', { session: false }), defaultController.fetchTaxonomyValues);

module.exports = router;
