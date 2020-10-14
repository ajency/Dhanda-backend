const logger = require("simple-node-logger").createSimpleLogger({ timestampFormat:'YYYY-MM-DD HH:mm:ss.SSS' });
const helperService = new (require("../../services/HelperService"));

module.exports = {
    saveStaff: async (req, res) => {
        try {
            /** Validate Request */
            /** Check if salary type is passed */
            let requestValid = helperService.validateRequiredRequestParams(req.body, [ "salaryType" ]);
            if(!requestValid) {
                return res.status(200).send({ code: "error", message: "missing_params" });
            }

            let { salaryType } = req.body;
            /** Check the required params based on salary type */
            if(["monthly", "daily"].includes(salaryType)) {
                requestValid = helperService.validateRequiredRequestParams(req.body, [ "salary", "salaryPayoutDate", "dailyShiftDuration" ]);
            } else if(salaryType === "hourly") {
                requestValid = helperService.validateRequiredRequestParams(req.body, [ "salary", "salaryPayoutDate" ]);
            } else if(salaryType === "work_basis") {
                requestValid = helperService.validateRequiredRequestParams(req.body, [ "salary", "salaryPayoutDate" ]);
            } else if(salaryType === "weekly") {
                requestValid = helperService.validateRequiredRequestParams(req.body, [ "salary", "salaryPayoutDay", "dailyShiftDuration" ]);
            }

            if(!requestValid) {
                return res.status(200).send({ code: "error", message: "missing_params" });
            }            

            let { refId, staffName, countryCode, phone, salary, salaryPayoutDate, dailyShiftDuration, 
                salaryPayoutDay, currentBalanceType, pendingAmount } = req.body;
            

            return res.status(200).send({ code: "success", message: "success" });
        } catch(err) {
            await logger.error("Exception in add business api: ", err);
            res.status(200).send({ code: "error", message: "error" });
        }
    }
}