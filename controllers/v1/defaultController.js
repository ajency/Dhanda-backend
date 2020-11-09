const models = require("../../models");

module.exports = {
    default: (req, res) => {
        /** TODO: Remove this function */
        console.log(req.body);

        /** Sample DB connection code */
        // models.user.findOne().then((user) => {
        //     console.log(user.get("first_name"))
        // }).catch((err) => console.log(err));

        res.status(200).send("Root");
    }
}