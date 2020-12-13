const logger = require("simple-node-logger").createSimpleLogger({ timestampFormat:'YYYY-MM-DD HH:mm:ss.SSS' });
const models = require("../../models");
const moment = require("moment");
const ormService = new (require("../OrmService"));
const staffService = new (require("./StaffService"));

module.exports = class SalaryPeriodService {
    async fetchSalaryPeriodFor(staffId, periodStart, periodEnd) {
        return await models.staff_salary_period.findOne({ where: {
            staff_id: staffId,
            period_start: periodStart,
            period_end: periodEnd
        } });
    }

    async fetchOldestSalaryPeriod(staffId) {
        return await models.staff_salary_period.findOne({ where: {
                staff_id: staffId
            },
            order: [ ["period_start", "ASC"] ]
        });
    }

    async fetchPreviousSalaryPeriod(staffId, periodStart, periodEnd, periodType) {
        let { startDate, endDate } = await staffService.fetchPeriodDates(staffId, moment(periodStart).subtract(1, "days").format("YYYY-MM-DD"), true);
        return await this.fetchSalaryPeriodFor(staffId, startDate, endDate);
    }

    async createOrUpdateSalaryPeriod(staffId, staffSalaryPeriodObj, lastPeriodEntry = null) {
        /** Fetch the entry */
        let salaryPeriodEntry = await this.fetchSalaryPeriodFor(staffId, staffSalaryPeriodObj.period_start, staffSalaryPeriodObj.period_end);

        if(salaryPeriodEntry) {
            /** Update the entry */
            await models.staff_salary_period.update(staffSalaryPeriodObj, { where: { id: salaryPeriodEntry.id } });
            return;
        } else {
            /** Add the missing column values */
            staffSalaryPeriodObj.period_status = "in_progress";
            staffSalaryPeriodObj.locked = false;

            /** Create a new entry */
            await models.staff_salary_period.create(staffSalaryPeriodObj);

            /** Mark the old one as completed if it exists */
            if(!lastPeriodEntry) {
                lastPeriodEntry = await this.fetchPreviousSalaryPeriod(staffId, staffSalaryPeriodObj.period_start, 
                                            staffSalaryPeriodObj.period_end, staffSalaryPeriodObj.period_type);
            }
            if(lastPeriodEntry) {
                await models.staff_salary_period.update({ status: "completed" }, { where: { id: lastPeriodEntry.id } });
            }
        }
    }

    async fetchLatestSalaryPeriodsForStaff(staffIds) {
        if(!staffIds || staffIds.length === 0) {
            return [];
        }

        let query = "SELECT DISTINCT ON (staff_id) staff_id, business_id, staff_salary_type_txid, " 
            + "period_type, period_start, period_end, period_salary, period_status, locked, total_present, " 
            + "total_paid_leave, total_half_day, total_absent, total_hours, present_salary, paid_leave_salary, " 
            + "half_day_salary, total_hour_salary, total_overtime_salary, total_late_fine_salary, total_salary, " 
            + "total_payments, total_dues, payslip_url FROM staff_salary_periods " 
            + "WHERE staff_id IN ('" + staffIds.join("','") + "') "
            + "ORDER BY staff_id, period_start DESC";
        
        return ormService.runRawSelectQuery(query);
    }

    async fetchSalaryPeriodsForStaff(staffId, page = 1, perPage = 5) {
        return models.staff_salary_period.findAll({ where: { staff_id: staffId }, 
            offset: (page - 1) * perPage, limit: perPage,
            order: [ [ "period_start", "desc" ] ] });
    }

    async fetchStaffPeriodByDate(staffId, date) {
        let salaryPeriods = await ormService.runRawSelectQuery("SELECT * FROM staff_salary_periods WHERE staff_id = "
            + staffId + " AND period_start <= '" + date + "' "
            + " AND period_end >= '" + date + "'");
        
        if(salaryPeriods.length === 0) {
            return null;
        } else {
            return salaryPeriods[0];
        }
    }
}