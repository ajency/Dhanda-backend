const logger = require("simple-node-logger").createSimpleLogger({ timestampFormat: 'YYYY-MM-DD HH:mm:ss.SSS' });
const models = require("../../models");
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const ormService = new (require("../OrmService"));
const taxonomyService = new (require("../../services/v1/TaxonomyService"));
const businessService = new (require("../../services/v1/BusinessService"));
const staffService = new (require("../../services/v1/StaffService"));
const moment = require("moment");

module.exports = class AttendanceService {
    async fetchAttendanceByStaffIdsAndDate(staffIds, date) {
        return await models.attendance.findAll({
            where: { staff_id: { [Op.in]: staffIds }, date: date },
            include: [{ model: models.taxonomy, as: "dayStatus" }]
        });
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
}