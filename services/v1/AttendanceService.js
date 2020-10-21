const logger = require("simple-node-logger").createSimpleLogger({ timestampFormat:'YYYY-MM-DD HH:mm:ss.SSS' });
const models = require("../../models");
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const ormService = new (require("../OrmService"));
const taxonomyService = new (require("../../services/v1/TaxonomyService"));

module.exports = class AttendanceService {
    async fetchAttendanceByStaffIdsAndDate(staffIds, date) {
        return await models.attendance.findAll({ where: { staff_id: { [Op.in]: staffIds }, date: date },
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

        let updateEntry = false, backupEntry = null;

        if(attEntry) {
            updateEntry = true;
            backupEntry = attEntry;
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
            let metaObj = attEntry.meta;
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
            backupEntry = JSON.parse(JSON.stringify(backupEntry));
            history.push(backupEntry);
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
}