const logger = require("simple-node-logger").createSimpleLogger({ timestampFormat:'YYYY-MM-DD HH:mm:ss.SSS' });
const helperService = new (require("../../services/HelperService"));
const staffService = new (require("../../services/v1/StaffService"));
const staffIncomeMetaService = new (require("../../services/v1/StaffIncomeMetaService"));
const businessService = new (require("../../services/v1/BusinessService"));

module.exports = {
    saveStaff: async (req, res) => {
        try {
            /** Validate Request */
            /** Check if salary type is passed */
            let requestValid = helperService.validateRequiredRequestParams(req.body, [ "businessRefId", "salaryType", "currentBalanceType" ]);
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

            let { refId, businessRefId, staffName, countryCode, phone, salary, salaryPayoutDate, dailyShiftDuration, 
                salaryPayoutDay, currentBalanceType, pendingAmount } = req.body;
            
            let staffObj = {
                staffName: staffName, 
                countryCode: countryCode, 
                phone: phone,
                salaryType: salaryType, 
                salary: salary, 
                salaryPayoutDate: salaryPayoutDate, 
                dailyShiftDuration: dailyShiftDuration, 
                salaryPayoutDay: salaryPayoutDay 
            }

            /** Find the business */
            let businessObj = await businessService.fetchBusinessById(businessRefId, true);
            
            if(businessObj === null) {
                return res.status(200).send({ code: "error", message: "business_not_found" });
            }

            if(!refId) {
                /** Create a new staff */
                let staff = await staffService.createStaff(businessObj.id, staffObj);

                /** Add the current balance */
                if(staff !== null && currentBalanceType !== "no_dues") {
                    await staffIncomeMetaService.createStaffIncomeMeta(staff.id, "current_balance", currentBalanceType, pendingAmount);
                }
                return res.status(200).send({ code: "home", message: "success" });
            } else {
                /** Update the Staff */
                let updateCount = await staffService.updateStaff(refId, staffObj);

                if(updateCount[0] === 0) {
                    return res.status(200).send({ code: "error", message: "staff_not_found" });
                }

                /** Update the curent balance */
                await staffIncomeMetaService.updateLatestStaffIncomeMeta(updateCount[1][0].id, "current_balance", currentBalanceType, pendingAmount);
                return res.status(200).send({ code: "success", message: "success" });
            }
        } catch(err) {
            await logger.error("Exception in add business api: ", err);
            res.status(200).send({ code: "error", message: "error" });
        }
    }
}