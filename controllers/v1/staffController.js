const logger = require("simple-node-logger").createSimpleLogger({ timestampFormat:'YYYY-MM-DD HH:mm:ss.SSS' });
const helperService = new (require("../../services/HelperService"));
const staffService = new (require("../../services/v1/StaffService"));
const staffIncomeMetaService = new (require("../../services/v1/StaffIncomeMetaService"));
const businessService = new (require("../../services/v1/BusinessService"));
const userService = new (require("../../services/v1/UserService"));

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
            return res.status(200).send({ code: "error", message: "error" });
        }
    },

    fetchStaff: async (req, res) => {
        try {
            /** Validate Request */
            /** Check if salary type is passed */
            let requestValid = helperService.validateRequiredRequestParams(req.body, [ "refId" ]);
            if(!requestValid) {
                // TODO: uncomment this later
                // return res.status(200).send({ code: "error", message: "missing_params" });
            }

            let { refId } = req.query;

            // TODO: Remove this code later
            if(!refId) {
                /** Fetch the default business for user */
                let business = await userService.fetchDefaultBusinessForUser(req.user);

                /** Fetch staff for this business */
                if(business === null) {
                    return res.status(200).send({ code: "error", message: "staff_not_found" });
                } else {
                    let staffMembers = await staffService.fetchStaffForBusinessId(business.id);
                    if(staffMembers.length === 0) {
                        return res.status(200).send({ code: "error", message: "staff_not_found" });
                    } else {
                        /** Fetch the staff income meta */
                        let staffIncomeMeta = await staffIncomeMetaService.fetchStaffWithIncomeType(staffMembers[0].id, "current_balance");

                        return res.status(200).send({ code: "success", message: "sucess", data: {
                                refId: staffMembers[0].reference_id,
                                staffName: staffMembers[0].name,
                                businessRefId: business.reference_id,
                                countryCode: staffMembers[0].country_code,
                                phone: staffMembers[0].phone,
                                salaryType: staffMembers[0].taxonomy.value,
                                salary: staffMembers[0].salary,
                                salaryPayoutDate: staffMembers[0].cycle_start_date,
                                dailyShiftDuration: staffMembers[0].daily_shift_duration,
                                salaryPayoutDay: staffMembers[0].cycle_start_day,
                                currentBalanceType: (staffIncomeMeta) ? staffIncomeMeta.income_sub_type.value : null,
                                pendingAmount: (staffIncomeMeta) ? staffIncomeMeta.amount : null
                        } });
                    }
                }
            }
            // ----------------------------------

            let staff = await staffService.fetchStaff(refId, true);

            if(staff === null) {
                return res.status(200).send({ code: "error", message: "staff_not_found" });
            }

            /** Fetch the staff income meta */
            let staffIncomeMeta = await staffIncomeMetaService.fetchStaffWithIncomeType(staff.id, "current_balance");
            let data = {
                refId: staff.reference_id,
                staffName: staff.name,
                businessRefId: staff.business.reference_id,
                countryCode: staff.country_code,
                phone: staff.phone,
                salaryType: staff.taxonomy.value,
                salary: staff.salary,
                salaryPayoutDate: staff.cycle_start_date,
                dailyShiftDuration: staff.daily_shift_duration,
                salaryPayoutDay: staff.cycle_start_day,
                currentBalanceType: (staffIncomeMeta) ? staffIncomeMeta.income_sub_type.value : null,
                pendingAmount: (staffIncomeMeta) ? staffIncomeMeta.amount : null
            }

            return res.status(200).send({ code: "success", message: "success", data: data });

        } catch(err) {
            await logger.error("Exception in fetch staff api: ", err);
            return res.status(200).send({ code: "error", message: "error" });
        }
    }
}