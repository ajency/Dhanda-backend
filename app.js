/** Load env config */
const path = require('path');
const cron = require('node-cron');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const logger = require("simple-node-logger").createSimpleLogger({ timestampFormat:'YYYY-MM-DD HH:mm:ss.SSS' });
const morganBody = require("morgan-body");

/** Controllers */
const cronController = require("./controllers/v1/cronController");

if(process.env.TLS_CHECK != 0){
	process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;
}

/** Initialize Express */
const express = require("express");
const app = express();
app.use(express.json());

/** Log the request response in dev env */
if(process.env.LOG_REQ_RES === "true") {
	morganBody(app)
}

/** Routes */
app.use("/api", require("./api"));
app.use((req, res) => {
	res.status(404).send("ERR: 404");
});

/** Cron */
cron.schedule(" */30 * * * * ", async () => {
	await logger.info("Running populate daily attendance cron")
	cronController.populateDailyAttendance();
})

app.listen(process.env.PORT);
console.log("Listening on port " + process.env.PORT + "...");
