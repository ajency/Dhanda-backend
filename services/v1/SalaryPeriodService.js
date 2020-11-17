const logger = require("simple-node-logger").createSimpleLogger({ timestampFormat:'YYYY-MM-DD HH:mm:ss.SSS' });
const models = require("../../models");
const moment = require("moment");

module.exports = class SalaryPeriodService {
    async fetchSalaryPeriodFor(staffId, periodStart, periodEnd) {
        return await models.staff_salary_period.findOne({ where: {
            staff_id: staffId,
            period_start: periodStart,
            period_end: periodEnd
        } });
    }

    async createOrUpdateSalaryPeriod(staffId, staffSalaryPeriodObj) {
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
            let period = (staffSalaryPeriodObj.period_type === "weekly") ? "week" : "month";
            let lastPeriodStart = moment(staffSalaryPeriodObj.period_start).subtract(7, "days");
            let lastPeriodEnd = moment(staffSalaryPeriodObj.period_end).subtract(7, "days");

            let lastPeriodEntry = await this.fetchSalaryPeriodFor(staffId, lastPeriodStart, lastPeriodEnd);
            if(lastPeriodEntry) {
                await models.staff_salary_period.update({ status: "completed" }, { where: { id: lastPeriodEntry.id } });
            }
        }
    }
}