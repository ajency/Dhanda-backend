/** Load env config */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

if(process.env.TLS_CHECK != 0){
	process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;
}

/** Initialize Express */
const express = require("express");
const app = express();
app.use(express.json());

/** Routes */
app.use("/api", require("./api"));
app.use((req, res) => {
	res.status(404).send("ERR: 404");
});

app.listen(process.env.PORT);
console.log("Listening on port " + process.env.PORT + "...");
