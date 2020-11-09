const logger = require("simple-node-logger").createSimpleLogger({ timestampFormat:'YYYY-MM-DD HH:mm:ss.SSS' });
const models = require("../../models");
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const moment = require("moment");
const ormService = new (require("../OrmService"));
const taxonomyService = new (require("../../services/v1/TaxonomyService"));
const businessService = new (require("../../services/v1/BusinessService"));
const staffService = new (require("../../services/v1/StaffService"));

module.exports = class AttendanceService {
    async fetchAttendanceByStaffIdsAndDate(staffIds, date) {
        return await models.attendance.findAll({ where: { staff_id: { [Op.in]: staffIds }, date: date },
            include: [ { model: models.taxonomy, as: "dayStatus" } ] });
    }

    async fetchAttendanceByStaffIdsForPeriod(staffIds, startDate, endDate) {
        return await models.attendance.findAll({ where: { staff_id: { [Op.in]: staffIds }, date: { [Op.between]: startDate, endDate } },
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
        let dateObj = moment(date);
        let monthlyStartDate = dateObj.startOf("month").format("YYYY-MM-DD");
        let monthlyEndDate = dateObj.endOf("month").format("YYYY-MM-DD");
        let weeklyStartDate = dateObj.startOf("week").add(1, "days").format("YYYY-MM-DD");
        let weeklyEndDate = dateObj.endOf("week").add(1, "days").format("YYYY-MM-DD");

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

        /** Loop through each staff member and calculate the attendance */
        for(let staff of staffMembers) {
            if(staff.salaryType && staff.salaryType.value === "weekly") {
                this.createOrUpdateStaffPayroll(staff, "weekly", weeklyStartDate, weeklyEndDate, weeklyStaffAttMap.get(staff.id));
            } else {
                this.createOrUpdateStaffPayroll(staff, "monthly", monthlyStartDate, monthlyEndDate, monthlyStaffAttMap.get(staff.id));
            }
        }
    }

    async createOrUpdateStaffPayroll(staff, periodType, periodStart, periodEnd, periodAttendance = null, staffIsId = false) {
        if(staffIsId) {
            staff = await staffService.fetchStaff(staff, false);
        }

        // todo: remove this test code
        await models.staff_salary_period.create({
            business_id: staff.business_id,
            staff_id: staff.id,
            period_type: periodType,
            period_start: periodStart,
            period_end: periodEnd,
            period_status: "in_progress",
            locked: false,
            total_present: 10,
            total_paid_leave: 10,
            total_half_day: 10,
            total_absent: 10,
            present_salary: 10000,
            paid_leave_salary: 10000,
            half_day_salary: 10000,
            total_salary: 10000,
        });

    }
}