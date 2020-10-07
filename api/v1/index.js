/** Express initialization */
const express = require("express");
const router = express.Router();
const passport = require("passport");

/** Controllers */
const defaultController = require("../../controllers/v1/defaultController");

/** API auth middleware */
require("../../config/apiAuth")

/** Routes */
router.get("/", defaultController.default);

module.exports = router;
