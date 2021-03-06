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
                salaryPayoutDay, currentBalanceType, pendingAmount, disabled, deleted, currentBalanceRefId } = req.body;

            let staffObj = {
                staffName: staffName,
                countryCode: countryCode,
                phone: phone,
                salaryType: salaryType,
                salary: salary,
                salaryPayoutDate: salaryPayoutDate,
                dailyShiftDuration: dailyShiftDuration,
                salaryPayoutDay: salaryPayoutDay,
                disabled: disabled,
                deleted: deleted
            }

            /** Find the business */
            let businessObj = await businessService.fetchBusinessById(businessRefId, true);

            if (businessObj === null) {
                await logger.info("Save staff - business not found: " + businessRefId);
                return res.status(200).send({ code: "error", message: "business_not_found" });
            }

            /** Check if the user is an admin */
            let isAdmin = await businessService.isUserAdmin(req.user, businessObj.id);
            if(!isAdmin) {
                await logger.info("Save staff - not an admin. user: " + req.user + " business: " + businessObj.id);
                return res.status(200).send({ code: "error", message: "not_an_admin" });
            }

            if (!refId) {
                /** Create a new staff */
                let staff = await staffService.createStaff(businessObj.id, staffObj);

                /** Add the current balance */
                if (staff !== null && currentBalanceType && currentBalanceType !== "no_dues") {
                    if(currentBalanceType === "pending_dues") {
                        pendingAmount = -1 * pendingAmount;
                    }
                    await staffIncomeMetaService.createStaffIncomeMeta(staff.id, currentBalanceType, null, pendingAmount);
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
                    // await attendanceService.updateStaffPayrollFor(staff.business_id, date, true, [staff]);
                    await attendanceService.updateSalaryPeriod(staff.id, date);
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
                if(currentBalanceType) {
                    if(currentBalanceType === "no_dues") {
                        if(currentBalanceRefId) {
                            /** Delete the already added outstanding balance */
                            let updateRes = await staffIncomeMetaService.deleteStaffIncomeMeta(currentBalanceRefId);
                            if(updateRes && updateRes[0] > 0) {
                                /** Update the salary period */
                                attendanceService.updateSalaryPeriod(updateRes[1][0].staff_id, updateRes[1][0].date);
                            }
                        }
                    } else {
                        let updateRes = await staffIncomeMetaService.updateOrCreateLatestStaffIncomeMeta(updateCount[1][0].id, currentBalanceType, null, pendingAmount, null, currentBalanceRefId);
                        if(updateRes && updateRes[0] > 0) {
                            /** Update the salary period */
                            attendanceService.updateSalaryPeriod(updateRes[1][0].staff_id, updateRes[1][0].date);
                        }
                    }
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

            let staff = await staffService.fetchStaff(refId, true);

            if (staff === null) {
                await logger.info("Fetch staff - staff not found: " + refId);
                return res.status(200).send({ code: "error", message: "staff_not_found" });
            }

            /** Check if the user is an admin */
            let isAdmin = await businessService.isUserAdmin(req.user, staff.business.id);
            if(!isAdmin) {
                await logger.info("Fetch staff - not an admin. user: " + req.user + " business: " + staff.business.id);
                return res.status(200).send({ code: "error", message: "not_an_admin" });
            }

            /** Fetch the staff income meta */
            let staffIncomeMeta = await staffIncomeMetaService.fetchStaffIncomeType(staff.id, "pending_dues");
            if(!staffIncomeMeta) {
                staffIncomeMeta = await staffIncomeMetaService.fetchStaffIncomeType(staff.id, "outstanding_balance");
            }
            let pendingAmount = (staffIncomeMeta) ? staffIncomeMeta.amount : null;
            if(pendingAmount && pendingAmount < 0) {
                pendingAmount = pendingAmount * -1;
            }
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
                currentBalanceType: (staffIncomeMeta) ? staffIncomeMeta.income_type.value : null,
                pendingAmount: pendingAmount,
                currentBalanceRefId: (staffIncomeMeta) ? staffIncomeMeta.reference_id : null,
                disabled: staff.disabled,
                deleted: staff.deleted
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

            /** Check if the user is an admin */
            let isAdmin = await businessService.isUserAdmin(req.user, staff.business.id);
            if(!isAdmin) {
                await logger.info("Fetch staff - not an admin. user: " + req.user + " business: " + staff.business.id);
                return res.status(200).send({ code: "error", message: "not_an_admin" });
            }

            /** Fetch the latest salary period plus the next five salary periods */
            let salaryPeriodEntries = await salaryPeriodService.fetchSalaryPeriodsForStaff(staff.id, 1, 5);
            
            let salaryPeriodList = [];
            let totalAmountDue = null;
            let rtStartDate = null, rtEndDate = null;
            for(let salaryPeriodEntry of salaryPeriodEntries) {
                if(totalAmountDue === null) {
                    totalAmountDue = salaryPeriodEntry.total_dues;
                    rtStartDate = salaryPeriodEntry.period_start;
                    rtEndDate = salaryPeriodEntry.period_end;
                    rtSalaryPeriod = salaryPeriodEntry;
                }

                salaryPeriodList.push({
                    periodType: staff.salaryType.value === "weekly" ? "weekly" : "monthly",
                    periodStart: salaryPeriodEntry.period_start,
                    periodEnd: salaryPeriodEntry.period_end,
                    amountDue: helperService.roundOff(parseFloat(salaryPeriodEntry.total_dues), 2),
                    daysWorked: salaryPeriodEntry.total_present + salaryPeriodEntry.total_paid_leave + salaryPeriodEntry.total_half_day,
                    daysTotal: moment(salaryPeriodEntry.period_end).diff(moment(salaryPeriodEntry.period_start), "days") + 1,
                    hoursWorked: salaryPeriodEntry.total_hours,
                    salary: staff.salary,
                    salaryType: staff.salaryType.value
                });
            }

            /** Fetch the recent transactions */
            let recentTransactions = [];
            if(rtStartDate && rtEndDate) {
                /** Fetching all so that the disableClearDues can be determined */
                recentTransactions = await attendanceService.fetchStaffSalaryTransactions(staff, rtStartDate, rtEndDate, rtSalaryPeriod);
            }

            let disableClearDues = false;
            let totalDuesPaid = 0;
            for(let rt of recentTransactions) {
                /** Dues paid are stored negative but the above method returns the as -ve for the api */
                if(rt.transactionType === "dues_paid") {
                    totalDuesPaid += (rt.amount) ? parseFloat(rt.amount) : 0;
                }
            }

            let totalDue = "", currentPayable = "";
            if(rtSalaryPeriod) {
                /** Basically last period's dues */
                totalDue = helperService.roundOff(parseFloat(rtSalaryPeriod.total_dues) + parseFloat(rtSalaryPeriod.total_salary) - parseFloat(rtSalaryPeriod.total_payments), 2);
                // currentPayable = helperService.roundOff(totalDue - parseFloat(rtSalaryPeriod.total_salary) + parseFloat(rtSalaryPeriod.total_payments), 2);
                currentPayable = helperService.roundOff(parseFloat(rtSalaryPeriod.total_dues) - totalDue, 2);
            }

            /** Remove the latest salary period from the list */
            if(salaryPeriodList && salaryPeriodList.length > 0) {
                salaryPeriodList.shift();
            }
            
            if(totalDue && (totalDue + totalDuesPaid) >= 0) {
                disableClearDues = true;
            }

            /** Keep only 3 most recent transactions */
            if(recentTransactions && recentTransactions.length > 0) {
                recentTransactions = recentTransactions.slice(0, 3);
            }

            let data = {
                name: staff.name,
                countryCode: staff.country_code,
                phone: staff.phone,
                totalDue: totalDue,
                totalDueUpto: rtStartDate ? moment(rtStartDate).subtract(1, "days").format("YYYY-MM-DD") : "",
                currentPayable: currentPayable,
                currentPayableFrom: rtStartDate ? moment(rtStartDate).format("YYYY-MM-DD") : "",
                currency: staff.business.currency,
                salaryPeriod: salaryPeriodList,
                recentTransactions: recentTransactions,
                disableClearDues: disableClearDues
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

            /** Check if the user is an admin */
            let isAdmin = await businessService.isUserAdmin(req.user, staff.business.id);
            if(!isAdmin) {
                await logger.info("Fetch single staff dues (paginated) - not an admin. user: " + req.user + " business: " + staff.business.id);
                return res.status(200).send({ code: "error", message: "not_an_admin" });
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
                    amountDue: helperService.roundOff(parseFloat(salaryPeriodEntry.total_dues), 2),
                    daysWorked: salaryPeriodEntry.total_present + salaryPeriodEntry.total_paid_leave + salaryPeriodEntry.total_half_day,
                    daysTotal: moment(salaryPeriodEntry.period_end).diff(moment(salaryPeriodEntry.period_start), "days") + 1,
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
    },

    fetchStaffDuesBreakup: async (req, res) => {
        try {
            let { staffRefId, date } = req.params;

            /** Fetch the staff */
            let staff = await staffService.fetchStaff(staffRefId, true);
            if(!staff) {
                await logger.info("Fetch staff dues breakup - staff not found for reference id: " + staffRefId);
                return res.status(200).send({ code: "error", message: "staff_not_found" });
            }

            /** Check if the user is an admin */
            let isAdmin = await businessService.isUserAdmin(req.user, staff.business.id);
            if(!isAdmin) {
                await logger.info("Fetch staff - not an admin. user: " + req.user + " business: " + staff.business.id);
                return res.status(200).send({ code: "error", message: "not_an_admin" });
            }

            /** Fetch the date's staff period */
            let salaryPeriod = await salaryPeriodService.fetchStaffPeriodByDate(staff.id, date);

            /** Fetch the transactions */
            let transactions = [];
            if(salaryPeriod) {
                transactions = await attendanceService.fetchStaffSalaryTransactions(staff, salaryPeriod.period_start, salaryPeriod.period_end, salaryPeriod);
            }

            let data = {
                name: staff.name,
                countryCode: staff.country_code,
                phone: staff.phone,
                currency: staff.business.currency,
                salarySummary: {
                    periodType: staff.salaryType.value === "weekly" ? "weekly" : "monthly",
                    periodStart: salaryPeriod ? salaryPeriod.period_start : "",
                    periodEnd: salaryPeriod ? salaryPeriod.period_end : "",
                    amountDue: salaryPeriod ? helperService.roundOff(- parseFloat(salaryPeriod.total_salary) + parseFloat(salaryPeriod.total_payments), 2) * -1 : "",
                    daysWorked: salaryPeriod ? salaryPeriod.total_present + salaryPeriod.total_paid_leave + salaryPeriod.total_half_day : "",
                    daysTotal: salaryPeriod ? moment(salaryPeriod.period_end).diff(moment(salaryPeriod.period_start), "days") + 1 : "",
                    hoursWorked: salaryPeriod ? salaryPeriod.total_hours : "",
                    salary: staff.salary,
                    salaryType: staff.salaryType.value
                },
                transactions: transactions
            };

            return res.status(200).send({ code: "success", message: "success", data: data });
        } catch (err) {
            await logger.error("Exception in fetch staff dues breakup api: ", err);
            return res.status(200).send({ code: "error", message: "error" });
        }
    },

    addStaffPayment: async (req, res) => {
        try {
            let { staffRefId } = req.params;

            /** Fetch the staff */
            let staff = await staffService.fetchStaff(staffRefId, true);
            if(!staff) {
                await logger.info("Add staff payment - staff not found for reference id: " + staffRefId);
                return res.status(200).send({ code: "error", message: "staff_not_found" });
            }

            /** Check if the user is an admin */
            let isAdmin = await businessService.isUserAdmin(req.user, staff.business.id);
            if(!isAdmin) {
                await logger.info("Add staff payment - not an admin. user: " + req.user + " business: " + staff.business.id);
                return res.status(200).send({ code: "error", message: "not_an_admin" });
            }

            let { refId, date, type, amount, description } = req.body;

            if(['allowance', 'bonus', 'payment_given', 'loan_given', 'dues_paid'].includes(type)) {
                amount = -1 * parseFloat(amount);
            }

            /** Update or create the staff income meta */
            await staffIncomeMetaService.updateOrCreateLatestStaffIncomeMeta(staff.id, type, null, amount, description, refId, date);

            /** Update the salary period */
            await attendanceService.updateSalaryPeriod(staff.id, date);

            return res.status(200).send({ code: "success", message: "success" });
        } catch (err) {
            await logger.error("Exception in add staff payment api: ", err);
            return res.status(200).send({ code: "error", message: "error" });
        }
    },

    addSalaryCycle: async (req, res) => {
        try {
            let { staffRefId } = req.params;

            /** Fetch the staff */
            let staff = await staffService.fetchStaff(staffRefId, true);
            if(!staff) {
                await logger.info("Add staff salary cycle - staff not found for reference id: " + staffRefId);
                return res.status(200).send({ code: "error", message: "staff_not_found" });
            }

            /** Check if the user is an admin */
            let isAdmin = await businessService.isUserAdmin(req.user, staff.business.id);
            if(!isAdmin) {
                await logger.info("Add staff salary cycle - not an admin. user: " + req.user + " business: " + staff.business.id);
                return res.status(200).send({ code: "error", message: "not_an_admin" });
            }

            /** Get the date for which to populate the attendance and salary period */
            let date = moment().utcOffset(staff.business.timezone ? staff.business.timezone : "+00:00").format("YYYY-MM-DD");
            let oldestSalaryPeriod = await salaryPeriodService.fetchOldestSalaryPeriod(staff.id);
            if(oldestSalaryPeriod) {
                date = moment(oldestSalaryPeriod.period_start).subtract(1, "days").format("YYYY-MM-DD");
            }
            
            /** Add the default attendance */
            await attendanceService.addDefaultAttendanceForCurrentPeriod(staff, date);
            
            /** Add the salary period */
            await attendanceService.updateSalaryPeriod(staff.id, date);

            return res.status(200).send({ code: "success", message: "success" });
        } catch (err) {
            await logger.error("Exception in add staff salary cycle api: ", err);
            return res.status(200).send({ code: "error", message: "error" });
        }
    }
}