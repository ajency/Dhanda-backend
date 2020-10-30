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
const cronController = require("../../controllers/v1/cronController");

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
router.get("/business/:businessRefId/attendance", passport.authenticate('jwt', { session: false }), attendanceController.fetchBusinessStaffAttendance);
router.post("/staff/:staffRefId/attendance/status", passport.authenticate('jwt', { session: false }), attendanceController.saveDayStatus);
router.post("/staff/:staffRefId/attendance/overtime", passport.authenticate('jwt', { session: false }), attendanceController.saveOvertime);
router.post("/staff/:staffRefId/attendance/lateFine", passport.authenticate('jwt', { session: false }), attendanceController.saveLateFine);
router.post("/staff/:staffRefId/attendance/note", passport.authenticate('jwt', { session: false }), attendanceController.saveNote);
router.get("/staff/:staffRefId/attendance", passport.authenticate('jwt', { session: false }), attendanceController.fetchSingleStaffAttendance);

/** Staff */
router.post("/saveStaff", passport.authenticate('jwt', { session: false }), staffController.saveStaff);
router.get("/staff", passport.authenticate('jwt', { session: false }), staffController.fetchStaff);

/** Others */
router.get("/taxonomy", passport.authenticate('jwt', { session: false }), defaultController.fetchTaxonomyValues);

/** Crons */
router.get("/cron/populateDailyAttendance", cronController.populateDailyAttendance);

module.exports = router;
