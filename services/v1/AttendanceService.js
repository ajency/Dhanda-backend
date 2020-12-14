const logger = require("simple-node-logger").createSimpleLogger({ timestampFormat: 'YYYY-MM-DD HH:mm:ss.SSS' });
const models = require("../../models");
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const moment = require("moment");
const ormService = new (require("../OrmService"));
const taxonomyService = new (require("./TaxonomyService"));
const businessService = new (require("./BusinessService"));
const staffService = new (require("./StaffService"));
const helperService = new (require("../HelperService"));
const salaryPeriodService = new (require("./SalaryPeriodService"));
const ruleService = new (require("./RuleService"));
const staffIncomeMetaService = new (require("./StaffIncomeMetaService"));

module.exports = class AttendanceService {
    async fetchAttendanceByStaffIdsAndDate(staffIds, date) {
        return await models.attendance.findAll({
            where: { staff_id: { [Op.in]: staffIds }, date: date },
            include: [{ model: models.taxonomy, as: "dayStatus" }]
        });
    }

    async fetchAttendanceByStaffIdsForPeriod(staffIds, startDate, endDate) {
        return await models.attendance.findAll({ where: { staff_id: { [Op.in]: staffIds }, date: { [Op.between]: [ startDate, endDate ] } },
            order: [ [ "staff_id", "asc" ], [ "date", "asc" ] ],
            include: [ { model: models.taxonomy, as: "dayStatus" } ] });
    }

    async fetchLatestPunchInTimeFor(staffIds) {
        if (staffIds && staffIds.length === 0) {
            return [];
        }

        let rawQuery = "SELECT DISTINCT ON (staff_id) staff_id, punch_in_time FROM attendances WHERE"
            + " staff_id in (" + staffIds.join(",") + ")" +
            " AND punch_in_time IS NOT NULL ORDER BY staff_id, date DESC;"
        return await ormService.runRawSelectQuery(rawQuery);
    }

    /**
     * Expected params = {
     *           dayStatus: present,
     *           punchIn: null,
     *           punchOut: null,
     *           overtime: null,
     *           overtimePay: null,
     *           lateFineHours: null,
     *           lateFineAmount: null,
     *           note: null,
     *           updatedBy: userId,
     *           source: "user-action"
     *       }
     * Whichever values are not passed are assumed as null.
     * When attId is passed, update is done.
     * @param {*} staffId 
     * @param {*} params 
     * @param {*} attId 
     */
    async createOrUpdateAttendance(staffId, date, params) {
        if (!staffId) {
            return;
        }

        /** Fetch the entry for the day */
        let attEntry = await models.attendance.findOne({ where: { staff_id: staffId, date: date } });

        let updateEntry = false, entryBackup = null;

        if (attEntry) {
            updateEntry = true;
            entryBackup = attEntry;
        } else {
            attEntry = {};
        }

        /** Update the entry */
        if (params.hasOwnProperty("dayStatus")) {
            if (params.dayStatus) {
                let dayStatusTx = await taxonomyService.findTaxonomy("day_status", params.dayStatus);
                attEntry.day_status_txid = (dayStatusTx) ? dayStatusTx.id : null;
            } else {
                attEntry.day_status_txid = null;
            }
        }
        if (params.hasOwnProperty("date")) {
            attEntry.date = date;
        }
        if (params.hasOwnProperty("punchIn")) {
            attEntry.punch_in_time = (params.punchIn) ? params.punchIn : null;
        }
        if (params.hasOwnProperty("punchOut")) {
            attEntry.punch_out_time = (params.punchOut) ? params.punchOut : null;
        }
        if (params.hasOwnProperty("overtime")) {
            attEntry.overtime = (params.overtime) ? params.overtime : null;
        }
        if (params.hasOwnProperty("overtimePay")) {
            attEntry.overtime_pay = (params.overtimePay) ? params.overtimePay : null;
        }
        if (params.hasOwnProperty("lateFineHours")) {
            attEntry.late_fine_hours = (params.lateFineHours) ? params.lateFineHours : null;
        }
        if (params.hasOwnProperty("lateFineAmount")) {
            attEntry.late_fine_amount = (params.lateFineAmount) ? params.lateFineAmount : null;
        }
        if (params.hasOwnProperty("note")) {
            let metaObj = attEntry.meta ? attEntry.meta : {};
            metaObj.note = params.note;
            attEntry.meta = metaObj;
        }
        if (params.hasOwnProperty("updatedBy")) {
            attEntry.updated_by = params.updatedBy;
        }
        if (params.hasOwnProperty("source")) {
            attEntry.source = params.source;
        }

        if (updateEntry) {
            /** In case of update store the history in the meta column */
            let metaObj = (attEntry.meta !== null && attEntry.meta !== undefined) ? attEntry.meta : {};
            let history = metaObj.hasOwnProperty("history") ? metaObj.history : [];
            entryBackup = JSON.parse(JSON.stringify(entryBackup));
            if (entryBackup.meta) {
                delete entryBackup.meta.history;
            }
            history.push(entryBackup);
            metaObj.history = history;
            attEntry.meta = metaObj;
            let updateRes = await models.attendance.update(JSON.parse(JSON.stringify(attEntry)), { where: { id: attEntry.id }, returning: true });
            if (updateRes[0] > 0) {
                return updateRes[1][0];
            } else {
                return null;
            }
        } else {
            attEntry.staff_id = staffId;
            attEntry.date = date;
            return await models.attendance.create(attEntry);
        }
    }

    async populateStaffAttendanceFor(business, date, businessIsId = false) {
        /** Fetch the business obj */
        if (businessIsId) {
            business = await businessService.fetchBusinessById(business);
        }

        /** Fetch all the staff members */
        let staffMembers = await staffService.fetchStaffForBusinessId(business.id);
        let allStaffIds = staffMembers.map((s) => { return s.id });

        /** Check if any attendance for any of the staff is already present */
        let staffAttendance = await this.fetchAttendanceByStaffIdsAndDate(allStaffIds, date)
        let staffAttMap = new Map();
        for (let sa of staffAttendance) {
            staffAttMap.set(sa.staff_id, sa);
        }

        /** Loop through all the staff members and generate the entries for bulk insert */
        let bulkInsertEntries = [];
        let dayStatusTx = await taxonomyService.findTaxonomy("day_status", "present");
        for (let staff of staffMembers) {
            if (!staffAttMap.has(staff.id)) {
                bulkInsertEntries.push({
                    staff_id: staff.id,
                    day_status_txid: (staff.salaryType.value === "hourly") ? null : (dayStatusTx ? dayStatusTx.id : null),
                    date: date,
                    source: "cron"
                });
            }
        }

        /** Bulk insert these entries */
        await models.attendance.bulkCreate(bulkInsertEntries);
    }

    async fetchStaffAttendanceForPeriod(staffId, fromDate, toDate) {
        return await models.attendance.findAll({
            where: {
                staff_id: staffId,
                date: { [Op.between]: [fromDate, toDate] }
            },
            order: [["date", "desc"]]
        });
    }

    async updateStaffPayrollFor(business, date, businessIsId = false, staffMembers = []) {
        /** Fetch the business obj */
        if(businessIsId) {
            business = await businessService.fetchBusinessById(business);
        }
        
        /** Fetch all the staff members */
        if(staffMembers.length === 0) {
            staffMembers = await staffService.fetchStaffForBusinessId(business.id);
        }
        let monthlyStaffIds = [];
        let weeklyStaffIds = [];
        let allStaffIds = staffMembers.map((s) => { 
            if(s.salaryType) {
                if(s.salaryType.value === "weekly") {
                    weeklyStaffIds.push(s.id);
                } else {
                    monthlyStaffIds.push(s.id);
                }
            }
            return s.id
        });

        /** Compute the monthly and weekly period start and end dates */
        let dateObj = moment(date, "YYYY-MM-DD");

        /** Calculate the business month days */
        // let businessMonthDays = 30;
        // if(business.taxonomy.value === "calendar_month") {
        //     businessMonthDays = dateObj.daysInMonth();
        // }

        /** Loop through each staff member and calculate the attendance */
        for(let staff of staffMembers) {
            /** Compute the start and end date of the period */
            // let startDate = null, endDate = null;
            // if(["monthly", "daily", "hourly", "work_basis"].includes(staff.salaryType.value)) {
            //     /** Monthly Staff */
            //     startDate = moment(date).startOf("month");
            //     if (staff.cycle_start_date) {
            //         startDate.add(staff.cycle_start_date - 1, "days");
            //         if (startDate.isAfter(moment(date))) {
            //             startDate.subtract(1, "months");
            //         }
            //     }
            //     endDate = moment(startDate).add(1, "month").subtract(1, "day");
            // } else if (["weekly"].includes(staff.salaryType.value)) {
            //     /** Weekly Staff */
            //     startDate = moment(date).startOf("week");
            //     if (staff.cycle_start_day) {
            //         startDate.add(staff.cycle_start_day, "days");
            //         if (startDate.isAfter(moment(date))) {
            //             startDate.subtract(1, "weeks");
            //         }
            //     }
            //     endDate = moment(startDate).add(1, "week").subtract(1, "day");
            // }
            // let { startDate, endDate } = await staffService.fetchPeriodDates(staff, date);

            // if(staff.salaryType && staff.salaryType.value === "weekly") {
            //     await this.createOrUpdateStaffPayroll(staff, "weekly", startDate, endDate, businessMonthDays);
            // } else {
            //     await this.createOrUpdateStaffPayroll(staff, "monthly", startDate, endDate, businessMonthDays);
            // }
            await this.updateSalaryPeriod(staff.id, date);
        }
    }

    async fetchPerDayAndPerMinuteSalary(staff, businessMonthDays, staffIsId = false) {
        if(staffIsId) {
            staff = await staffService.fetchStaff(staff, false);
        }

        let perDaySalary = 0, perMinuteSalary = 0;
        if(staff.salaryType) {
            switch(staff.salaryType.value) {
                case "monthly":
                    perDaySalary = parseFloat(staff.salary) / businessMonthDays;
                    perMinuteSalary = perDaySalary / (helperService.convertHoursStringToMinutes(staff.daily_shift_duration));
                    break;
                case "weekly":
                    perDaySalary = parseFloat(staff.salary) / 7;
                    perMinuteSalary = perDaySalary / (helperService.convertHoursStringToMinutes(staff.daily_shift_duration));
                    break;
                case "daily":
                    perDaySalary = parseFloat(staff.salary);
                    perMinuteSalary = perDaySalary / (helperService.convertHoursStringToMinutes(staff.daily_shift_duration));
                    break;
                case "hourly":
                    perMinuteSalary = parseFloat(staff.salary) / 60;
                    break;
            }
        }
        return { perDaySalary: perDaySalary, perMinuteSalary: perMinuteSalary };
    }

    async createOrUpdateStaffPayroll(staff, periodType, periodStart, periodEnd, businessMonthDays = 30, periodAttendance = null, staffIsId = false) {
        if(staffIsId) {
            staff = await staffService.fetchStaff(staff, false);
        }

        /** Fetch the attendance if not passed */
        if(periodAttendance === null) {
            periodAttendance = await this.fetchAttendanceByStaffIdsForPeriod([ staff.id ], periodStart, periodEnd);
        }

        /** Data to be added to the payroll */
        let totalPresent = 0, totalAbsent = 0, totalHalfDay = 0, totalPaidLeave = 0, totalHoursInMinutes = 0;
        let presentSalary = 0, halfDaySalary = 0, paidLeaveSalary = 0, totalHourSalary = 0, totalOvertimeSalary = 0, totalLateFineSalary = 0, totalSalary = 0;

        // /** Salary per day */
        // let perDaySalary = 0, perMinuteSalary = 0;
        // if(staff.salaryType) {
        //     switch(staff.salaryType.value) {
        //         case "monthly":
        //             perDaySalary = parseFloat(staff.salary) / businessMonthDays;
        //             perMinuteSalary = perDaySalary / (helperService.convertHoursStringToMinutes(staff.daily_shift_duration));
        //             break;
        //         case "weekly":
        //             perDaySalary = parseFloat(staff.salary) / 7;
        //             perMinuteSalary = perDaySalary / (helperService.convertHoursStringToMinutes(staff.daily_shift_duration));
        //             break;
        //         case "daily":
        //             perDaySalary = parseFloat(staff.salary);
        //             perMinuteSalary = perDaySalary / (helperService.convertHoursStringToMinutes(staff.daily_shift_duration));
        //             break;
        //         case "hourly":
        //             perMinuteSalary = parseFloat(staff.salary) / 60;
        //             break;
        //     }
        // }

        let { perDaySalary, perMinuteSalary } = await this.fetchPerDayAndPerMinuteSalary(staff, businessMonthDays);

        /** Salary calc rule for the staff  */
        let salaryRule = await ruleService.fetchRuleByNameAndGroup("salary_calculation", staff.rule_group_id);

        /** Loop through each day */
        for(let att of periodAttendance) {
            let overtimePayPerMinute = 0, overtimeInMinutes = 0, lateFineMinutes = 0, todaysMinutes = 0;

            /** Day status counts */
            if(att.dayStatus) {
                switch(att.dayStatus.value) {
                    case "present":
                        totalPresent += 1;
                        break;
                    case "absent":
                        totalAbsent += 1;
                        break;
                    case "half_day":
                        totalHalfDay += 1;
                        break;
                    case "paid_leave":
                        totalPaidLeave += 1;
                        break;
                    default:
                        break;
                }
            }

            if(staff.salaryType && staff.salaryType.value === "hourly") {
                if(att.punch_in_time && att.punch_out_time) {
                    let minutes = moment(moment().format("YYYY-MM-DD ") + att.punch_out_time)
                                        .diff(moment().format("YYYY-MM-DD ") + att.punch_in_time, 'minutes');
                    totalHoursInMinutes += minutes;
                    todaysMinutes = minutes;
                }
            }

            /** Overtime */
            if(att.overtime && att.overtime_pay) {
                overtimePayPerMinute = att.overtime_pay / 60;
                overtimeInMinutes = helperService.convertHoursStringToMinutes(att.overtime);
            }

            /** Late fine */
            if(att.late_fine_hours) {
                lateFineMinutes = helperService.convertHoursStringToMinutes(att.late_fine_hours);
            }

            /** Use Rule Engine for salary calculation */
            let fact = {
                salaryType: staff.salaryType ? staff.salaryType.value : "",
                status: att.dayStatus ? att.dayStatus.value : "",
                perDaySalary: perDaySalary,
                dayInMinutes: todaysMinutes,
                perMinuteSalary: perMinuteSalary,
                overtimeMinutes: overtimeInMinutes,
                overtimePayPerMinute: overtimePayPerMinute,
                lateFineAmount: att.late_fine_amount ? parseFloat(att.late_fine_amount) : 0,
                lateFineMinutes: lateFineMinutes,
                salary: 0,
                presentSalary: 0,
                paidLeaveSalary: 0,
                halfDaySalary: 0,
                hourSalary: 0,
                overtimeSalary: 0,
                lateFineSalary: 0
            };

            let ruleEngineOutput = await ruleService.executeRule(helperService.rulesFromJSON(salaryRule.rule_json), fact);
            if(ruleEngineOutput) {
                presentSalary += ruleEngineOutput.presentSalary;
                halfDaySalary += ruleEngineOutput.halfDaySalary;
                paidLeaveSalary += ruleEngineOutput.paidLeaveSalary;
                totalHourSalary += ruleEngineOutput.hourSalary;
                totalOvertimeSalary += ruleEngineOutput.overtimeSalary;
                totalLateFineSalary += ruleEngineOutput.lateFineSalary;
            }

            /** Resetting today's minutes value */
            todaysMinutes = 0;
        }

        /** Calculate the total salary and hours */
        totalSalary = presentSalary + halfDaySalary + paidLeaveSalary + totalHourSalary + totalOvertimeSalary + totalLateFineSalary;

        let totalPayments = 0;

        /** Fetch the payments for the period */
        let payments = await staffIncomeMetaService.fetchPaymentsForStaffBetween(staff.id, periodStart, periodEnd);

        for(let p of payments) {
            totalPayments += parseFloat(p.amount);
        }

        /** Fetch the last period */
        let previousSalaryPeriod = await salaryPeriodService.fetchPreviousSalaryPeriod(staff.id, periodStart, periodEnd, periodType);
        let previousDues = previousSalaryPeriod ? parseFloat(previousSalaryPeriod.total_dues) : 0;

        let totalDues = - totalSalary + totalPayments + previousDues;

        /** Create of update the period salary */
        await salaryPeriodService.createOrUpdateSalaryPeriod(staff.id, {
            business_id: staff.business_id,
            staff_id: staff.id,
            staff_salary_type_txid: staff.salary_type_txid,
            period_type: periodType,
            period_start: periodStart,
            period_end: periodEnd,
            period_salary: helperService.roundOff(staff.salary, 4),
            total_present: totalPresent,
            total_paid_leave: totalPaidLeave,
            total_half_day: totalHalfDay,
            total_absent: totalAbsent,
            total_hours: helperService.convertMinutesToHoursString(totalHoursInMinutes),
            present_salary: helperService.roundOff(presentSalary, 4),
            paid_leave_salary: helperService.roundOff(paidLeaveSalary, 4),
            half_day_salary: helperService.roundOff(halfDaySalary, 4),
            total_hour_salary: helperService.roundOff(totalHourSalary, 4),
            total_overtime_salary: helperService.roundOff(totalOvertimeSalary, 4),
            total_late_fine_salary: helperService.roundOff(totalLateFineSalary, 4),
            total_salary: helperService.roundOff(totalSalary, 4),
            total_payments: helperService.roundOff(totalPayments, 4),
            total_dues: helperService.roundOff(totalDues, 4)
        }, previousSalaryPeriod);
    }

    async addDefaultAttendanceForCurrentPeriod(staff, date, isId = false) {
        if (isId) {
            staff = await staffService.fetchStaff(staff, false);
        }

        /** Get the date from which to populate the attendance */
        let startDate = null, endDate = moment(date);
        if (["monthly", "daily", "hourly", "work_basis"].includes(staff.salaryType.value)) {
            /** Monthly Staff */
            startDate = moment(date).startOf("month");
            if (staff.cycle_start_date) {
                startDate.add(staff.cycle_start_date - 1, "days");
                if (startDate.isAfter(moment(date))) {
                    startDate.subtract(1, "months");
                }
            }
        } else if (["weekly"].includes(staff.salaryType.value)) {
            /** Weekly Staff */
            startDate = moment(date).startOf("week");
            if (staff.cycle_start_day) {
                startDate.add(staff.cycle_start_day, "days");
                if (startDate.isAfter(moment(date))) {
                    startDate.subtract(1, "weeks");
                }
            }
        }

        /** Populate the default attendance for the staff */
        while (startDate.isSameOrBefore(endDate)) {
            await this.createOrUpdateAttendance(staff.id, startDate.format("YYYY-MM-DD"), { dayStatus: (staff.salaryType.value === "hourly") ? null : "present" });
            startDate.add(1, "days");
        }
    }

    async fetchLatestAttendanceForStaff(staffIds) {
        if(!staffIds || staffIds.length === 0) {
            return [];
        }

        let query = "SELECT DISTINCT ON (staff_id) staff_id, day_status_txid, date, " 
            + "punch_in_time, punch_out_time FROM attendances " 
            + "WHERE staff_id IN ('" + staffIds.join("','") + "') "
            + "ORDER BY staff_id, date DESC";
        
        return ormService.runRawSelectQuery(query);
    }

    /** 
     * Get the period that the "date" lies in and creates / updates the salary period
     * Also updates the total dues and other values of the subsequent months
     */
    async updateSalaryPeriod(staffId, date) {
        /** Fetch the staff information */
        let staff = await staffService.fetchStaff(staffId);

        let business = await businessService.fetchBusinessById(staff.business_id);

        let { startDate, endDate } = await staffService.fetchPeriodDates(staff, date);
        let businessCurrentDate = moment().utcOffset(business.timezone).format("YYYY-MM-DD");

        /** Calculate the business month days */
        // let dateObj = moment(date, "YYYY-MM-DD");
        // let businessMonthDays = 30;
        // if(business.taxonomy.value === "calendar_month") {
            // businessMonthDays = dateObj.daysInMonth();
            let businessMonthDays = moment(endDate).diff(moment(startDate), "days") + 1;
        // }

        /** Update the salary */      
        if(staff.salaryType && staff.salaryType.value === "weekly") {
            await this.createOrUpdateStaffPayroll(staff, "weekly", startDate, endDate, businessMonthDays);
            /** Update the next salary periods */
            while(moment(endDate).isBefore(moment(businessCurrentDate))) {
                let dates = await staffService.fetchPeriodDates(staff, moment(endDate).add(1, "days"));
                startDate = dates.startDate;
                endDate = dates.endDate;
                businessMonthDays = moment(endDate).diff(moment(startDate), "days") + 1;
                await this.createOrUpdateStaffPayroll(staff, "weekly", startDate, endDate, businessMonthDays);
            }
        } else {
            await this.createOrUpdateStaffPayroll(staff, "monthly", startDate, endDate, businessMonthDays);
            /** Update the next salary periods */
            while(moment(endDate).isBefore(moment(businessCurrentDate))) {
                let dates = await staffService.fetchPeriodDates(staff, moment(endDate).add(1, "days"));
                startDate = dates.startDate;
                endDate = dates.endDate;
                businessMonthDays = moment(endDate).diff(moment(startDate), "days") + 1;
                await this.createOrUpdateStaffPayroll(staff, "monthly", startDate, endDate, businessMonthDays);
            }
        }
    }

    /**
     * Note: salaryPeriod will be used for getting the day status agg. This is to avoid calculations, already done.
     * This includes the signs as per the staff i.e. deduction type transactions are -ve even though they are stored as _ve
     * @param {*} staffId 
     * @param {*} startDate 
     * @param {*} endDate 
     * @param {*} limit 
     */
    async fetchStaffSalaryTransactions(staff, startDate, endDate, salaryPeriod, limit = null) {
        let transactions = [];
        /** Fetch the attendance */
        let staffAtt = await this.fetchAttendanceByStaffIdsForPeriod([staff.id], startDate, endDate);
        let statusMap = new Map();
        let business = null;
        for(let att of staffAtt) {
            statusMap.set(att.day_status_txid, att);

            /** Add the late fine transaction if present */
            if(att.late_fine_amount) {
                transactions.push({
                    transactionType: "late_fine",
                    amount: helperService.roundOff(parseFloat(att.late_fine_amount), 2) * -1,
                    description: "",
                    date: att.date,
                    days: "",
                    hours: "",
                    rate: "",
                    refId: ""
                });
            } else if(att.late_fine_hours) {
                if(!business) {
                    business = await businessService.fetchBusinessById(staff.business_id);
                }
                // let businessMonthDays = 30;
                // if(business.taxonomy.value === "calendar_month") {
                    let pd = await staffService.fetchPeriodDates(staff, att.date);
                    let spStartDate = pd.startDate, spEndDate = pd.endDate;
                    let businessMonthDays = moment(spEndDate).diff(moment(spStartDate), "days") + 1;
                // }
                let { perMinuteSalary } = await this.fetchPerDayAndPerMinuteSalary(staff, businessMonthDays);

                let lateFineHoursAmount = (perMinuteSalary) ? perMinuteSalary * helperService.convertHoursStringToMinutes(att.late_fine_hours) : null;
                transactions.push({
                    transactionType: "late_fine",
                    amount: lateFineHoursAmount ? helperService.roundOff(lateFineHoursAmount, 2) * -1 : "",
                    description: "",
                    date: att.date,
                    days: "",
                    hours: att.late_fine_hours,
                    rate: "",
                    refId: ""
                });
            }

            /** Add overtime transaction if present */
            if(att.overtime) {
                let overtimePayPerMinute = parseFloat(att.overtime_pay) / 60;
                let overtimeInMinutes = helperService.convertHoursStringToMinutes(att.overtime);
                transactions.push({
                    transactionType: "overtime",
                    amount: helperService.roundOff(overtimePayPerMinute * overtimeInMinutes, 2),
                    description: "",
                    date: att.date,
                    days: "",
                    hours: att.overtime,
                    rate: helperService.roundOff(parseFloat(att.overtime_pay), 2),
                    refId: ""
                });
            }
        }

        /** Add the day status transactions */
        statusMap.forEach((att) => {
            if(!att.dayStatus) {
                return;
            }
            let amount = "", days = "";
            if(att.dayStatus.value === "present") {
                amount = (salaryPeriod && salaryPeriod.present_salary) ? helperService.roundOff(parseFloat(salaryPeriod.present_salary), 2) : "";
                days = (salaryPeriod && salaryPeriod.total_present) ? salaryPeriod.total_present : "";
            } else if(att.dayStatus.value === "paid_leave") {
                amount = (salaryPeriod && salaryPeriod.paid_leave_salary) ? helperService.roundOff(parseFloat(salaryPeriod.paid_leave_salary), 2) : "";
                days = (salaryPeriod && salaryPeriod.total_paid_leave) ? salaryPeriod.total_paid_leave : "";
            } else if(att.dayStatus.value === "half_day") {
                amount = (salaryPeriod && salaryPeriod.half_day_salary) ? helperService.roundOff(parseFloat(salaryPeriod.half_day_salary), 2) : "";
                days = (salaryPeriod && salaryPeriod.total_half_day) ? salaryPeriod.total_half_day : "";
            } else if(att.dayStatus.value === "absent") {
                return;
            }
            transactions.push({
                transactionType: att.dayStatus.value,
                amount: amount,
                description: "",
                date: att.date,
                days: days,
                hours: "",
                rate: "",
                refId: ""
            });
        });

        /** Add the hour transaction */
        if(salaryPeriod && salaryPeriod.total_hours !== "00:00") {
            transactions.push({
                transactionType: "hours",
                amount: helperService.roundOff(parseFloat(salaryPeriod.total_hour_salary), 2),
                description: "",
                date: statusMap.get(null) ? statusMap.get(null).date : null,
                days: "",
                hours: salaryPeriod.total_hours,
                rate: "",
                refId: ""
            });
        }

        /** Fetch the transactions */
        let staffIncomeTransactions = await staffIncomeMetaService.fetchPaymentsForStaffBetween(staff.id, startDate, endDate);
        for(let tr of staffIncomeTransactions) {
            transactions.push({
                transactionType: tr.income_type.value,
                amount: helperService.roundOff(parseFloat(tr.amount), 2) * -1,
                description: tr.description,
                date: tr.date,
                days: "",
                hours: "",
                rate: "",
                refId: tr.reference_id
            });
        }

        /** Sort the transactions */
        transactions.sort((a,b) => {
            return new Date(b.date) - new Date(a.date);
        });

        /** Limit the values */
        if(limit) {
            return transactions.slice(0, limit);
        } else {
            return transactions;
        }
    }
}