const logger = require("simple-node-logger").createSimpleLogger({ timestampFormat: 'YYYY-MM-DD HH:mm:ss.SSS' });
const helperService = new (require("../../services/HelperService"));
const staffService = new (require("../../services/v1/StaffService"));
const staffIncomeMetaService = new (require("../../services/v1/StaffIncomeMetaService"));
const businessService = new (require("../../services/v1/BusinessService"));
const userService = new (require("../../services/v1/UserService"));
const ormService = new (require("../../services/OrmService"));
const attendanceService = new (require("../../services/v1/AttendanceService"));
const moment = require("moment");
const awsService = new (require("../../services/AwsService"));
const taxonomyService = new (require("../../services/v1/TaxonomyService"));
const salaryPeriodService = new (require("../../services/v1/SalaryPeriodService"));
const staffWorkService = new (require("../../services/v1/StaffWorkService"));
const fs = require("fs");
const awsConfig = (require("../../config/thirdPartyConfig.json")).aws;
const pdfService = new (require("../../services/v1/PdfService"));


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

                /** If work basis staff then fetch the units of work */
                let totalUnitsOfWork = 0;
                if(staff.salaryType.value === "work_basis") {
                    let workDoneInSalaryPeriod = await staffWorkService.fetchStaffWorkByStaffId(staff.id, salaryPeriodEntry.period_start, salaryPeriodEntry.period_end);
                    if(workDoneInSalaryPeriod) {
                        for(let wd of workDoneInSalaryPeriod) {
                            totalUnitsOfWork += wd.units;
                        }
                    }
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
                    salaryType: staff.salaryType.value,
                    totalUnits: totalUnitsOfWork
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
                totalDue = helperService.roundOff(parseFloat(rtSalaryPeriod.total_dues) + parseFloat(rtSalaryPeriod.total_salary) - parseFloat(rtSalaryPeriod.total_payments) + parseFloat(rtSalaryPeriod.total_work_salary), 2);
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
                /** If work basis staff then fetch the units of work */
                let totalUnitsOfWork = 0;
                if(staff.salaryType.value === "work_basis") {
                    let workDoneInSalaryPeriod = await staffWorkService.fetchStaffWorkByStaffId(staff.id, salaryPeriodEntry.period_start, salaryPeriodEntry.period_end);
                    if(workDoneInSalaryPeriod) {
                        for(let wd of workDoneInSalaryPeriod) {
                            totalUnitsOfWork += wd.units;
                        }
                    }
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
                    salaryType: staff.salaryType.value,
                    totalUnits: totalUnitsOfWork
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
    },

    saveStaffWork: async (req, res) => {
        try {
            let { staffRefId } = req.params;

            /** Fetch the staff */
            let staff = await staffService.fetchStaff(staffRefId, true);
            if(!staff) {
                await logger.info("Save staff work - staff not found for reference id: " + staffRefId);
                return res.status(200).send({ code: "error", message: "staff_not_found" });
            }

            /** Check if the user is an admin */
            let isAdmin = await businessService.isUserAdmin(req.user, staff.business.id);
            if(!isAdmin) {
                await logger.info("Save staff work - not an admin. user: " + req.user + " business: " + staff.business.id);
                return res.status(200).send({ code: "error", message: "not_an_admin" });
            }

            /** Check if the staff is of the type work basis */
            if(staff.salaryType.value !== "work_basis") {
                await logger.info("Save staff work - staff not of type work basis for reference id: " + staffRefId);
                return res.status(200).send({ code: "error", message: "staff_not_work_basis" });
            }

            /** Check if the staff_work entry exists for the provided reference id */
            let staffWork = null;
            if(req.body.refId) {
                staffWork = await staffWorkService.fetchStaffWorkByRefId(req.body.refId);
                if(!staffWork) {
                    await logger.info("Save staff work - staff work not found for staff work reference id: " + req.body.refId);
                    return res.status(200).send({ code: "error", message: "staff_work_not_found" });
                }
            }

            /** Check if we need to delete the entry */
            if(req.body.delete) {
                if(!staffWork) {
                    await logger.info("Save staff work - cannot delete because staff work not found for staff work reference id: " + req.body.refId);
                    return res.status(200).send({ code: "error", message: "staff_work_not_found" });
                }
                await staffWorkService.deleteStaffWork(req.body.refId);
                return res.status(200).send({ code: "success", message: "success" });
            }

            /** Add or update the staff work entry */
            let staffWorkObj = {
                staff_id: staff.id,
                date: req.body.date,
                type: req.body.type,
                rate: req.body.rate,
                units: req.body.units,
                total: parseFloat(req.body.rate) * parseFloat(req.body.units)
            }
            if(staffWorkObj.total === null || isNaN(staffWorkObj.total)) {
                staffWorkObj.total = 0;
            }
            await staffWorkService.saveOrUpdateStaffWork(staffWorkObj, req.body.refId);

            /** Update the salary period */
            await attendanceService.updateSalaryPeriod(staff.id, req.body.date);

            return res.status(200).send({ code: "success", message: "success" });
        } catch(err) {
            await logger.error("Exception in save staff work api: ", err);
            return res.status(200).send({ code: "error", message: "error" });
        }
    },

    saveStaffWorkRate: async (req, res) => {
        try {
            let { staffRefId } = req.params;

            /** Fetch the staff */
            let staff = await staffService.fetchStaff(staffRefId, true);
            if(!staff) {
                await logger.info("Save staff work rate - staff not found for reference id: " + staffRefId);
                return res.status(200).send({ code: "error", message: "staff_not_found" });
            }

            /** Check if the user is an admin */
            let isAdmin = await businessService.isUserAdmin(req.user, staff.business.id);
            if(!isAdmin) {
                await logger.info("Save staff work rate - not an admin. user: " + req.user + " business: " + staff.business.id);
                return res.status(200).send({ code: "error", message: "not_an_admin" });
            }

            /** Check if the staff is of the type work basis */
            if(staff.salaryType.value !== "work_basis") {
                await logger.info("Save staff work rate - staff not of type work basis for reference id: " + staffRefId);
                return res.status(200).send({ code: "error", message: "staff_not_work_basis" });
            }

            /** Check if the staff_work_rate entry exists for the provided reference id */
            let staffWorkRate = null;
            if(req.body.refId) {
                staffWorkRate = await staffWorkService.fetchStaffWorkRateByRefId(req.body.refId);
                if(!staffWorkRate) {
                    await logger.info("Save staff work rate - staff work rate not found for staff work rate reference id: " + req.body.refId);
                    return res.status(200).send({ code: "error", message: "rate_not_found" });
                }
            }

            /** Check if we need to delete the entry */
            if(req.body.delete) {
                if(!staffWorkRate) {
                    await logger.info("Save staff work rate - cannot delete because staff work rate not found for staff work rate reference id: " + req.body.refId);
                    return res.status(200).send({ code: "error", message: "rate_not_found" });
                }
                await staffWorkService.deleteStaffWorkRate(req.body.refId);
                return res.status(200).send({ code: "success", message: "success" });
            }

            /** Add or update the staff work entry */
            let staffWorkRateObj = {
                staff_id: staff.id,
                type: req.body.type,
                rate: req.body.rate
            }
            await staffWorkService.saveOrUpdateStaffWorkRate(staffWorkRateObj, req.body.refId);

            return res.status(200).send({ code: "success", message: "success" });
        } catch(err) {
            await logger.error("Exception in save staff work rate api: ", err);
            return res.status(200).send({ code: "error", message: "error" });
        }
    },

    fetchStaffWorkRate: async (req, res) => {
        try {
            let { staffRefId } = req.params;

            /** Fetch the staff */
            let staff = await staffService.fetchStaff(staffRefId, true);
            if(!staff) {
                await logger.info("Fetch staff work rate - staff not found for reference id: " + staffRefId);
                return res.status(200).send({ code: "error", message: "staff_not_found" });
            }

            /** Check if the user is an admin */
            let isAdmin = await businessService.isUserAdmin(req.user, staff.business.id);
            if(!isAdmin) {
                await logger.info("Fetch staff work rate - not an admin. user: " + req.user + " business: " + staff.business.id);
                return res.status(200).send({ code: "error", message: "not_an_admin" });
            }

            /** Check if the staff is of the type work basis */
            if(staff.salaryType.value !== "work_basis") {
                await logger.info("Fetch staff work rate - staff not of type work basis for reference id: " + staffRefId);
                return res.status(200).send({ code: "error", message: "staff_not_work_basis" });
            }

            /** Fetch the staff work rates */
            let staffRates = await staffWorkService.fetchStaffWorkRatesByStaffId(staff.id);
            let rates = [];
            for(let sr of staffRates) {
                rates.push({
                    refId: sr.reference_id,
                    type: sr.type,
                    rate: parseFloat(sr.rate)
                });
            }
            
            let data = {
                rates: rates
            }

            return res.status(200).send({ code: "success", message: "success", data: data });
        } catch(err) {
            await logger.error("Exception in fetch staff work rate api: ", err);
            return res.status(200).send({ code: "error", message: "error" });
        }
    },

    fetchPayslipList: async (req, res) => {
        try {
            let { staffRefId } = req.params;

            /** Fetch the staff */
            let staff = await staffService.fetchStaff(staffRefId, true);
            if(!staff) {
                await logger.info("Fetch payslip list - staff not found for reference id: " + staffRefId);
                return res.status(200).send({ code: "error", message: "staff_not_found" });
            }

            /** Check if the user is an admin */
            let isAdmin = await businessService.isUserAdmin(req.user, staff.business.id);
            if(!isAdmin) {
                await logger.info("Fetch payslip list - not an admin. user: " + req.user + " business: " + staff.business.id);
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
                    periodStart: salaryPeriodEntry.period_start,
                    periodEnd: salaryPeriodEntry.period_end,
                });
            }

            let data = {
                payslips: salaryPeriodList
            };

            return res.status(200).send({ code: "success", message: "success", data: data });
        } catch (err) {
            await logger.error("Exception in fetch payslip list api: ", err);
            return res.status(200).send({ code: "error", message: "error" });
        }
    },

    downloadPayslip: async (req, res) => {
        try {
            let { staffRefId } = req.params;

            /** Fetch the staff */
            let staff = await staffService.fetchStaff(staffRefId, true);
            if(!staff) {
                await logger.info("Download payslip - staff not found for reference id: " + staffRefId);
                return res.status(200).send({ code: "error", message: "staff_not_found" });
            }

            /** Check if the user is an admin */
            let isAdmin = await businessService.isUserAdmin(req.user, staff.business.id);
            if(!isAdmin) {
                await logger.info("Download payslip - not an admin. user: " + req.user + " business: " + staff.business.id);
                return res.status(200).send({ code: "error", message: "not_an_admin" });
            }
            
            let { periodStart, periodEnd } = req.query;

            /** Verify that both period start and end have been sent */
            if(!periodStart || !periodEnd) {
                await logger.info("Download payslip - period start or end missing. staff " + staff.id );
                return res.status(200).send({ code: "error", message: "params_missing" });
            }

            let data = {
                pdf: ""
            };

            /** Fetch the salary period */
            let salaryPeriod = await salaryPeriodService.fetchSalaryPeriodFor(staff.id, periodStart, periodEnd);
            console.log("salary period",salaryPeriod);
            /** Check if payslip has already been generated */
            let filePath = null;
            if(salaryPeriod.payslip_url) {
                filePath = await awsService.downloadFileFromS3Url(salaryPeriod.payslip_url);
            } else {
                /** Fetch the required data to generate the payslip */
                let pdfData = await salaryPeriodService.fetchDataForPayslipGeneration(staff, salaryPeriod);
                // TODO remove logger after testing
                console.log(">>>>>>>>> " + JSON.stringify(pdfData));

                console.log(">>>>>>>>> ",pdfData)

                pdfData.salaryOnPayroll = pdfService.getDisplayCurrency(pdfData.salaryOnPayroll,pdfData.currency)
                pdfData.grossEarnings = pdfService.getDisplayCurrency(pdfData.grossEarnings,pdfData.currency)
                pdfData.grossDeductions = pdfService.getDisplayCurrency(pdfData.grossDeductions,pdfData.currency)
                pdfData.netPayableSalary = pdfService.getDisplayCurrency(pdfData.netPayableSalary,pdfData.currency)
                
                let temp = []
                pdfData.earnings.forEach(element => {
                    temp.push({earningTitle:element.earningTitle,earningAmount:pdfService.getDisplayCurrency(element.earningAmount,pdfData.currency)})
                });
                pdfData.earnings = temp;
                
                temp = []
                 pdfData.deductions.forEach(element => {
                    temp.push({deductionTitle:element.deductionTitle,deductionAmount:pdfService.getDisplayCurrency(element.deductionAmount,pdfData.currency)})
                });
                pdfData.deductions = temp;
               

                let fileSlug = "PS" + staff.reference_id + moment(periodStart).format("YYYYMMDD");

                /** Generate the PDF */
                filePath = await pdfService.generatePaySlipPdf(pdfData, fileSlug + "_" + (new Date()).getTime());

                /** Upload to S3 - auto delete false */

                let s3Url = await awsService.uploadFileToS3(awsConfig.s3.payslipBucket, filePath, "payslip", fileSlug, false);

                /** Set the file url and locked to true */
                await ormService.updateModel("staff_salary_period", salaryPeriod.id, {
                    payslip_url: s3Url,
                    locked: true
                });
            }

            if(filePath) {
                /** Convert file to base64 */
                data.pdf = fs.readFileSync(filePath, {encoding: 'base64'});
                /** Clear the file from the local storage */
                fs.unlink(filePath, (err) => { console.log("File cleared.") });
            }
            

            return res.status(200).send({ code: "success", message: "success", data: data.pdf });
        } catch (err) {
            await logger.error("Exception in download payslip api: ", err);
            return res.status(200).send({ code: "error", message: "error" });
        }
    }
}