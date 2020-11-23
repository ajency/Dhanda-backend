const logger = require("simple-node-logger").createSimpleLogger({ timestampFormat: 'YYYY-MM-DD HH:mm:ss.SSS' });
const helperService = new (require("../../services/HelperService"));
const staffService = new (require("../../services/v1/StaffService"));
const staffIncomeMetaService = new (require("../../services/v1/StaffIncomeMetaService"));
const businessService = new (require("../../services/v1/BusinessService"));
const userService = new (require("../../services/v1/UserService"));
const ormService = new (require("../../services/OrmService"));
const attendanceService = new (require("../../services/v1/AttendanceService"));
const moment = require("moment");
const taxonomyService = new (require("../../services/v1/TaxonomyService"));
const salaryPeriodService = new (require("../../services/v1/SalaryPeriodService"));

module.exports = {
    saveStaff: async (req, res) => {
        try {
            /** Validate Request */
            /** Check if salary type is passed */
            let requestValid = helperService.validateRequiredRequestParams(req.body, ["businessRefId", "salaryType", "currentBalanceType"]);
            if (!requestValid) {
                await logger.info("Save staff - missing parameters");
                return res.status(200).send({ code: "error", message: "missing_params" });
            }

            let { salaryType } = req.body;
            /** Check the required params based on salary type */
            if (["monthly", "daily"].includes(salaryType)) {
                requestValid = helperService.validateRequiredRequestParams(req.body, ["salary", "salaryPayoutDate", "dailyShiftDuration"]);
            } else if (salaryType === "hourly") {
                requestValid = helperService.validateRequiredRequestParams(req.body, ["salary", "salaryPayoutDate"]);
            } else if (salaryType === "work_basis") {
                requestValid = helperService.validateRequiredRequestParams(req.body, ["salary", "salaryPayoutDate"]);
            } else if (salaryType === "weekly") {
                requestValid = helperService.validateRequiredRequestParams(req.body, ["salary", "salaryPayoutDay", "dailyShiftDuration"]);
            }

            if (!requestValid) {
                await logger.info("Save staff - missing parameters.");
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

            if (businessObj === null) {
                await logger.info("Save staff - business not found: " + businessRefId);
                return res.status(200).send({ code: "error", message: "business_not_found" });
            }

            if (!refId) {
                /** Create a new staff */
                let staff = await staffService.createStaff(businessObj.id, staffObj);

                /** Add the current balance */
                if (staff !== null && currentBalanceType !== "no_dues") {
                    await staffIncomeMetaService.createStaffIncomeMeta(staff.id, "current_balance", currentBalanceType, pendingAmount);
                }

                /** Update the business country code if not present */
                if (!businessObj.country_code) {
                    await ormService.updateModel("business", businessObj.id, { country_code: countryCode });
                }

                /** Add the staff attendance for the current cycle */
                if (staff) {
                    /** Get the date in the business timezone */
                    let date = moment().utcOffset(businessObj.timezone ? businessObj.timezone : "+00:00").format("YYYY-MM-DD");
                    /** Fetch the salary type if not already fetched */
                    staff.salaryType = await taxonomyService.findTaxonomyById(staff.salary_type_txid);
                    await attendanceService.addDefaultAttendanceForCurrentPeriod(staff, date);
                    /** Add the salary period */
                    await attendanceService.updateStaffPayrollFor(staff.business_id, date, true, [staff]);
                }

                return res.status(200).send({ code: "home", message: "success" });
            } else {
                /** Update the Staff */
                let updateCount = await staffService.updateStaff(refId, staffObj);

                if (updateCount[0] === 0) {
                    await logger.info("Save staff - staff not found: " + refId);
                    return res.status(200).send({ code: "error", message: "staff_not_found" });
                }

                /** Update the curent balance */
                if (currentBalanceType !== "no_dues") {
                    await staffIncomeMetaService.updateOrCreateLatestStaffIncomeMeta(updateCount[1][0].id, "current_balance", currentBalanceType, pendingAmount);
                }
                return res.status(200).send({ code: "success", message: "success" });
            }
        } catch (err) {
            await logger.error("Exception in add business api: ", err);
            return res.status(200).send({ code: "error", message: "error" });
        }
    },

    fetchStaff: async (req, res) => {
        try {
            /** Validate Request */
            /** Check if salary type is passed */
            let requestValid = helperService.validateRequiredRequestParams(req.body, ["refId"]);
            if (!requestValid) {
                // TODO: uncomment this later
                // return res.status(200).send({ code: "error", message: "missing_params" });
            }

            let { refId } = req.query;

            // TODO: Remove this code later after we have listing
            if (!refId) {
                /** Fetch the default business for user */
                let business = await userService.fetchDefaultBusinessForUser(req.user);

                /** Fetch staff for this business */
                if (business === null) {
                    await logger.info("Save staff - staff not found because of no default business for user: " + req.user);
                    return res.status(200).send({ code: "error", message: "staff_not_found" });
                } else {
                    let staffMembers = await staffService.fetchStaffForBusinessId(business.id);
                    if (staffMembers.length === 0) {
                        await logger.info("Save staff - no staff members present for default business for user: " + req.user);
                        return res.status(200).send({ code: "error", message: "staff_not_found" });
                    } else {
                        /** Fetch the staff income meta */
                        let staffIncomeMeta = await staffIncomeMetaService.fetchStaffWithIncomeType(staffMembers[0].id, "current_balance");

                        return res.status(200).send({
                            code: "success", message: "sucess", data: {
                                refId: staffMembers[0].reference_id,
                                staffName: staffMembers[0].name,
                                businessRefId: business.reference_id,
                                countryCode: staffMembers[0].country_code,
                                phone: staffMembers[0].phone,
                                salaryType: staffMembers[0].salaryType.value,
                                salary: staffMembers[0].salary,
                                salaryPayoutDate: staffMembers[0].cycle_start_date,
                                dailyShiftDuration: staffMembers[0].daily_shift_duration,
                                salaryPayoutDay: staffMembers[0].cycle_start_day,
                                currentBalanceType: (staffIncomeMeta) ? staffIncomeMeta.income_sub_type.value : null,
                                pendingAmount: (staffIncomeMeta) ? staffIncomeMeta.amount : null
                            }
                        });
                    }
                }
            }
            // ----------------------------------

            let staff = await staffService.fetchStaff(refId, true);

            if (staff === null) {
                await logger.info("Save staff - staff not found: " + refId);
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
                salaryType: staff.salaryType.value,
                salary: staff.salary,
                salaryPayoutDate: staff.cycle_start_date,
                dailyShiftDuration: staff.daily_shift_duration,
                salaryPayoutDay: staff.cycle_start_day,
                currentBalanceType: (staffIncomeMeta) ? staffIncomeMeta.income_sub_type.value : null,
                pendingAmount: (staffIncomeMeta) ? staffIncomeMeta.amount : null
            }

            return res.status(200).send({ code: "success", message: "success", data: data });

        } catch (err) {
            await logger.error("Exception in fetch staff api: ", err);
            return res.status(200).send({ code: "error", message: "error" });
        }
    },

    fetchStaffDues: async (req, res) => {
        try {
            let { staffRefId } = req.params;

            /** Fetch the staff */
            let staff = await staffService.fetchStaff(staffRefId, true);
            if(!staff) {
                await logger.info("Fetch single staff dues - staff not found for reference id: " + staffRefId);
                return res.status(200).send({ code: "error", message: "staff_not_found" });
            }

            /** Fetch the latest 5 salary periods */
            let salaryPeriodEntries = await salaryPeriodService.fetchSalaryPeriodsForStaff(staff.id);
            
            let salaryPeriodList = [];
            let totalAmountDue = null;
            for(let salaryPeriodEntry of salaryPeriodEntries) {
                if(totalAmountDue === null) {
                    totalAmountDue = salaryPeriodEntry.total_dues;
                }

                salaryPeriodList.push({
                    periodType: staff.salaryType.value === "weekly" ? "weekly" : "monthly",
                    periodStart: salaryPeriodEntry.period_start,
                    periodEnd: salaryPeriodEntry.period_end,
                    amountDue: salaryPeriodEntry.total_dues,
                    daysWorked: salaryPeriodEntry.total_present + salaryPeriodEntry.total_paid_leave + salaryPeriodEntry.total_half_day,
                    daysTotal: moment(salaryPeriodEntry.period_end).diff(moment(salaryPeriodEntry.period_start), "days"),
                    hoursWorked: salaryPeriodEntry.total_hours,
                    salary: staff.salary,
                    salaryType: staff.salaryType.value
                });
            }

            let data = {
                name: staff.name,
                countryCode: staff.country_code,
                phone: staff.phone,
                totalAmountDue: totalAmountDue,
                currency: staff.business.currency,
                salaryPeriod: salaryPeriodList
            };

            return res.status(200).send({ code: "success", message: "success", data: data });
        } catch (err) {
            await logger.error("Exception in fetch staff dues api: ", err);
            return res.status(200).send({ code: "error", message: "error" });
        }
    },

    fetchPaginatedStaffDues: async (req, res) => {
        try {
            let { staffRefId } = req.params;

            /** Fetch the staff */
            let staff = await staffService.fetchStaff(staffRefId, true);
            if(!staff) {
                await logger.info("Fetch single staff dues (paginated) - staff not found for reference id: " + staffRefId);
                return res.status(200).send({ code: "error", message: "staff_not_found" });
            }
            
            let { page, perPage } = req.query;

            /** Set the default values */
            if(!page) {
                page = 1;
            }
            if(!perPage) {
                perPage = 5;
            }

            /** Fetch the latest 5 salary periods */
            let salaryPeriodEntries = await salaryPeriodService.fetchSalaryPeriodsForStaff(staff.id, page, perPage);
            
            let salaryPeriodList = [];
            for(let salaryPeriodEntry of salaryPeriodEntries) {
                salaryPeriodList.push({
                    periodType: staff.salaryType.value === "weekly" ? "weekly" : "monthly",
                    periodStart: salaryPeriodEntry.period_start,
                    periodEnd: salaryPeriodEntry.period_end,
                    amountDue: parseFloat(salaryPeriodEntry.total_dues),
                    daysWorked: salaryPeriodEntry.total_present + salaryPeriodEntry.total_paid_leave + salaryPeriodEntry.total_half_day,
                    daysTotal: moment(salaryPeriodEntry.period_end).diff(moment(salaryPeriodEntry.period_start), "days"),
                    hoursWorked: salaryPeriodEntry.total_hours,
                    salary: staff.salary,
                    salaryType: staff.salaryType.value
                });
            }

            let data = {
                salaryPeriod: salaryPeriodList
            };

            return res.status(200).send({ code: "success", message: "success", data: data });
        } catch (err) {
            await logger.error("Exception in fetch staff dues (paginated) api: ", err);
            return res.status(200).send({ code: "error", message: "error" });
        }
    }
}