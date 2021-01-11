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
router.post("/sendOtp", loginController.sendOtp);
router.post("/verifyOtp", loginController.verifyOtp);
router.get("/init", defaultController.coldStart);
router.post("/saveBusiness", businessController.saveBusiness);

/** Protected Routes */
/** Business */
router.get("/business", passport.authenticate('jwt', { session: false }), businessController.fetchBusiness);
router.get("/business/:businessRefId/dues", passport.authenticate('jwt', { session: false }), businessController.fetchBusinessStaffDues);
router.post("/business/:businessRefId/verifyOwner", passport.authenticate('jwt', { session: false }), businessController.verifyOwner);
router.post("/business/:businessRefId/updatePhone", passport.authenticate('jwt', { session: false }), businessController.updatePhone);

/** Attendance */
router.get("/business/:businessRefId/attendance", passport.authenticate('jwt', { session: false }), attendanceController.fetchBusinessStaffAttendance);
router.post("/staff/:staffRefId/attendance/status", passport.authenticate('jwt', { session: false }), attendanceController.saveDayStatus);
router.post("/staff/:staffRefId/attendance/overtime", passport.authenticate('jwt', { session: false }), attendanceController.saveOvertime);
router.post("/staff/:staffRefId/attendance/lateFine", passport.authenticate('jwt', { session: false }), attendanceController.saveLateFine);
router.post("/staff/:staffRefId/attendance/note", passport.authenticate('jwt', { session: false }), attendanceController.saveNote);
router.get("/staff/:staffRefId/attendance", passport.authenticate('jwt', { session: false }), attendanceController.fetchSingleStaffAttendance);

/** Admin */
router.post("/business/:businessRefId/admin/invite", passport.authenticate('jwt', { session: false }), businessController.inviteAdmin);
router.post("/invite/:inviteRefId", passport.authenticate('jwt', { session: false }), businessController.adminInviteResponse);
router.post("/business/admin/invite/:inviteRefId/resend", passport.authenticate('jwt', { session: false }), businessController.resendInvite);
router.delete("/business/admin/invite/:inviteRefId", passport.authenticate('jwt', { session: false }), businessController.deleteInvite);
router.delete("/business/:businessRefId/admin/:adminRefId", passport.authenticate('jwt', { session: false }), businessController.removeAdmin);

/** Staff */
router.post("/saveStaff", passport.authenticate('jwt', { session: false }), staffController.saveStaff);
router.get("/staff", passport.authenticate('jwt', { session: false }), staffController.fetchStaff);
router.get("/staff/:staffRefId/dues", passport.authenticate('jwt', { session: false }), staffController.fetchStaffDues);
router.get("/staff/:staffRefId/dues/paginated", passport.authenticate('jwt', { session: false }), staffController.fetchPaginatedStaffDues);
router.get("/staff/:staffRefId/dues/:date", passport.authenticate('jwt', { session: false }), staffController.fetchStaffDuesBreakup);
router.post("/staff/:staffRefId/payment", passport.authenticate('jwt', { session: false }), staffController.addStaffPayment);
router.post("/staff/:staffRefId/addSalaryCycle", passport.authenticate('jwt', { session: false }), staffController.addSalaryCycle);
router.post("/staff/:staffRefId/work", passport.authenticate('jwt', { session: false }), staffController.saveStaffWork);
router.post("/staff/:staffRefId/workRate", passport.authenticate('jwt', { session: false }), staffController.saveStaffWorkRate);
router.get("/staff/:staffRefId/workRate", passport.authenticate('jwt', { session: false }), staffController.fetchStaffWorkRate);
router.get("/staff/:staffRefId/payslipList", passport.authenticate('jwt', { session: false }), staffController.fetchPayslipList);

/** Others */
router.get("/taxonomy", passport.authenticate('jwt', { session: false }), defaultController.fetchTaxonomyValues);
router.get("/profile", passport.authenticate('jwt', { session: false }), defaultController.getProfile);
router.post("/profile", passport.authenticate('jwt', { session: false }), defaultController.updateProfile);
router.post("/logout", passport.authenticate('jwt', { session: false }), loginController.logout);

/** Crons */
router.get("/cron/populateDailyAttendanceAndPayroll", cronController.populateDailyAttendanceAndPayroll);

/** Internal */
router.get("/addRule", defaultController.addRule);
router.get("/calculatePayrollForBusiness", attendanceController.calculatePayrollForBusiness);

module.exports = router;
