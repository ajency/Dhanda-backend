/** Express initialization */
const express = require("express");
const router = express.Router();

/** Versioned routes */
router.use("/v1", require("./v1"));
router.get('*', function(req, res){
  res.send('Not Found', 404);
});
router.post('*', function(req, res){
  res.send('Not Found', 404);
});

module.exports = router;