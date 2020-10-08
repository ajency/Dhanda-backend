/** Express initialization */
const express = require("express");
const router = express.Router();
const passport = require("passport");

/** Controllers */
const defaultController = require("../../controllers/v1/defaultController");
const loginController = require("../../controllers/v1/loginController");

/** API auth middleware */
require("../../config/apiAuth")

/** Routes */
router.get("/", defaultController.default);

/** Open APIs */
router.post("/login/sendOtp", loginController.sendOtp);

module.exports = router;
