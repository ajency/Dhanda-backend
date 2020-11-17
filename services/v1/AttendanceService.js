const logger = require("simple-node-logger").createSimpleLogger({ timestampFormat:'YYYY-MM-DD HH:mm:ss.SSS' });
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

module.exports = class AttendanceService {
    async fetchAttendanceByStaffIdsAndDate(staffIds, date) {
        return await models.attendance.findAll({ where: { staff_id: { [Op.in]: staffIds }, date: date },
            include: [ { model: models.taxonomy, as: "dayStatus" } ] });
    }

    async fetchAttendanceByStaffIdsForPeriod(staffIds, startDate, endDate) {
        return await models.attendance.findAll({ where: { staff_id: { [Op.in]: staffIds }, date: { [Op.between]: [ startDate, endDate ] } },
            order: [ [ "staff_id", "asc" ], [ "date", "asc" ] ],
            include: [ { model: models.taxonomy, as: "dayStatus" } ] });
    }

    async fetchLatestPunchInTimeFor(staffIds) {
        if(staffIds && staffIds.length === 0) {
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
        if(!staffId) {
            return;
        }
        
        /** Fetch the entry for the day */
        let attEntry = await models.attendance.findOne({ where: { staff_id: staffId, date: date } });

        let updateEntry = false, entryBackup = null;

        if(attEntry) {
            updateEntry = true;
            entryBackup = attEntry;
        } else {
            attEntry = {};
        }

        /** Update the entry */
        if(params.hasOwnProperty("dayStatus")) {
            if(params.dayStatus) {
                let dayStatusTx = await taxonomyService.findTaxonomy("day_status", params.dayStatus);
                attEntry.day_status_txid = (dayStatusTx) ? dayStatusTx.id : null;
            } else {
                attEntry.day_status_txid = null;
            }
        }
        if(params.hasOwnProperty("date")) {
            attEntry.date = date;
        }
        if(params.hasOwnProperty("punchIn")) {
            attEntry.punch_in_time = (params.punchIn) ? params.punchIn : null;
        }
        if(params.hasOwnProperty("punchOut")) {
            attEntry.punch_out_time = (params.punchOut) ? params.punchOut : null;
        }
        if(params.hasOwnProperty("overtime")) {
            attEntry.overtime = (params.overtime) ? params.overtime : null;
        }
        if(params.hasOwnProperty("overtimePay")) {
            attEntry.overtime_pay = (params.overtimePay) ? params.overtimePay : null;
        }
        if(params.hasOwnProperty("lateFineHours")) {
            attEntry.late_fine_hours = (params.lateFineHours) ? params.lateFineHours : null;
        }
        if(params.hasOwnProperty("lateFineAmount")) {
            attEntry.late_fine_amount = (params.lateFineAmount) ? params.lateFineAmount : null;
        }
        if(params.hasOwnProperty("note")) {
            let metaObj = attEntry.meta ? attEntry.meta : {};
            metaObj.note = params.note;
            attEntry.meta = metaObj;
        }
        if(params.hasOwnProperty("updatedBy")) {
            attEntry.updated_by = params.updatedBy;
        }
        if(params.hasOwnProperty("source")) {
            attEntry.source = params.source;
        }

        if(updateEntry) {
            /** In case of update store the history in the meta column */
            let metaObj = (attEntry.meta !== null && attEntry.meta !== undefined) ? attEntry.meta : {};
            let history = metaObj.hasOwnProperty("history") ? metaObj.history : [];
            entryBackup = JSON.parse(JSON.stringify(entryBackup));
            if(entryBackup.meta) {
                delete entryBackup.meta.history;
            }
            history.push(entryBackup);
            metaObj.history = history;
            attEntry.meta = metaObj;
            let updateRes = await models.attendance.update(JSON.parse(JSON.stringify(attEntry)) , { where: { id: attEntry.id }, returning: true });
            if(updateRes[0] > 0) {
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
        if(businessIsId) {
            business = await businessService.fetchBusinessById(business);
        }
        
        /** Fetch all the staff members */
        let staffMembers = await staffService.fetchStaffForBusinessId(business.id);
        let allStaffIds = staffMembers.map((s) => { return s.id});

        /** Check if any attendance for any of the staff is already present */
        let staffAttendance = await this.fetchAttendanceByStaffIdsAndDate(allStaffIds, date)
        let staffAttMap = new Map();
        for(let sa of staffAttendance) {
            staffAttMap.set(sa.staff_id, sa);
        }

        /** Loop through all the staff members and generate the entries for bulk insert */
        let bulkInsertEntries = [];
        let dayStatusTx = await taxonomyService.findTaxonomy("day_status", "present");
        for(let staff of staffMembers) {
            if(!staffAttMap.has(staff.id)) {
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
                date: { [Op.between]: [ fromDate, toDate ] }
            },
            order: [ [ "date", "desc" ] ]
        });
    }

    async updateStaffPayrollFor(business, date, businessIsId = false) {
        /** Fetch the business obj */
        if(businessIsId) {
            business = await businessService.fetchBusinessById(business);
        }
        
        /** Fetch all the staff members */
        let staffMembers = await staffService.fetchStaffForBusinessId(business.id);
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
        let monthlyStartDate = moment(dateObj).startOf("month").format("YYYY-MM-DD");
        let monthlyEndDate = moment(dateObj).endOf("month").format("YYYY-MM-DD");
        let weeklyStartDate = moment(dateObj).startOf("week").add(1, "days").format("YYYY-MM-DD");
        let weeklyEndDate = moment(dateObj).endOf("week").add(1, "days").format("YYYY-MM-DD");

        /** Fetch the staff attendance for the monthly staff in one query */
        let monthlyStaffAttMap = new Map();
        let monthlyStaffAtt = await this.fetchAttendanceByStaffIdsForPeriod(monthlyStaffIds, monthlyStartDate, monthlyEndDate);
        for(let att of monthlyStaffAtt) {
            let attArr = [];
            if(monthlyStaffAttMap.has(att.staff_id)) {
                attArr = monthlyStaffAttMap.get(att.staff_id);
            }
            attArr.push(att);
            monthlyStaffAttMap.set(att.staff_id, attArr);
        }

        /** Fetch the staff attendance for the weekly staff in one query */
        let weeklyStaffAttMap = new Map();
        let weeklyStaffAtt = await this.fetchAttendanceByStaffIdsForPeriod(weeklyStaffIds, weeklyStartDate, weeklyEndDate);
        for(let att of weeklyStaffAtt) {
            let attArr = [];
            if(weeklyStaffAttMap.has(att.staff_id)) {
                attArr = weeklyStaffAttMap.get(att.staff_id);
            }
            attArr.push(att);
            weeklyStaffAttMap.set(att.staff_id, attArr);
        }

        /** Calculate the business month days */
        let businessMonthDays = 30;
        if(business.taxonomy.value === "calendar_month") {
            businessMonthDays = dateObj.daysInMonth();
        }
        /** Loop through each staff member and calculate the attendance */
        for(let staff of staffMembers) {
            if(staff.salaryType && staff.salaryType.value === "weekly") {
                await this.createOrUpdateStaffPayroll(staff, "weekly", weeklyStartDate, weeklyEndDate, businessMonthDays, weeklyStaffAttMap.get(staff.id));
            } else {
                await this.createOrUpdateStaffPayroll(staff, "monthly", monthlyStartDate, monthlyEndDate, businessMonthDays, monthlyStaffAttMap.get(staff.id));
            }
        }
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

        /** Salary per day */
        let perDaySalary = 0, perMinuteSalary = 0;
        if(staff.salaryType) {
            switch(staff.salaryType.value) {
                case "monthly":
                    perDaySalary = staff.salary / businessMonthDays;
                    perMinuteSalary = perDaySalary / (helperService.convertHoursStringToMinutes(staff.daily_shift_duration));
                    break;
                case "weekly":
                    perDaySalary = staff.salary / 7;
                    perMinuteSalary = perDaySalary / (helperService.convertHoursStringToMinutes(staff.daily_shift_duration));
                    break;
                case "daily":
                    perDaySalary = staff.salary;
                    perMinuteSalary = perDaySalary / (helperService.convertHoursStringToMinutes(staff.daily_shift_duration));
                    break;
                case "hourly":
                    perMinuteSalary = staff.salary / 60;
                    break;
            }
        }


        /** Salary calc rule for the staff  */
        let salaryRule = await ruleService.fetchRuleByNameAndGroup("salary_calculation", staff.rule_group_id);

        /** Loop through each day */
        for(let att of periodAttendance) {
            let overtimePayPerMinute = 0, overtimeInMinutes = 0, lateFineMinutes = 0;

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
                dayInMinutes: totalHoursInMinutes,
                perMinuteSalary: perMinuteSalary,
                overtimeMinutes: overtimeInMinutes,
                overtimePayPerMinute: overtimePayPerMinute,
                lateFineAmount: att.late_fine_amount ? att.late_fine_amount : 0,
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
                totalHourSalary += ruleEngineOutput.halfDaySalary;
                totalOvertimeSalary += ruleEngineOutput.hourSalary;
                totalLateFineSalary += ruleEngineOutput.lateFineSalary;
            }
        }

        /** Calculate the total salary and hours */
        totalSalary = presentSalary + halfDaySalary + paidLeaveSalary + totalHourSalary + totalOvertimeSalary + totalLateFineSalary;

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
        });
    }
}