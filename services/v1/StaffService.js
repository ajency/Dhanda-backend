const logger = require("simple-node-logger").createSimpleLogger({ timestampFormat:'YYYY-MM-DD HH:mm:ss.SSS' });
const models = require("../../models");
const taxonomyService = new (require("./TaxonomyService"));
const helperService = new (require("../HelperService"));
const moment = require("moment");

module.exports = class StaffService {
    
    /**
     * Expected staffObj = {
     *      staffName: staffName, 
     *      countryCode: countryCode, 
     *      phone: phone,
     *      salaryType: salaryType,
     *      salary: salary, 
     *      salaryPayoutDate: salaryPayoutDate, 
     *      dailyShiftDuration: dailyShiftDuration, 
     *      salaryPayoutDay: salaryPayoutDay,
     *      ruleGroupId: ruleGroupId
     *  }
     */
    async createStaff(businessId, staffObj) {
        let salaryTypeTx = await taxonomyService.findTaxonomy("salary_type", staffObj.salaryType);

        /** If rule group is not passed then fetch and add the default rule group */
        let defaultRuleGroup = null;
        if(!staffObj.ruleGroupId) {
            /** Fetch the default rule group */
            defaultRuleGroup = await models.rule_group.findOne({ where: { name: "default", business_id: null } });
        }
        
        return await models.staff.create({
            reference_id: "S" + helperService.generateReferenceId(),
            business_id: businessId,
            name: staffObj.staffName,
            country_code: staffObj.countryCode,
            phone: staffObj.phone,
            salary_type_txid: salaryTypeTx.id,
            salary: staffObj.salary ? staffObj.salary : null,
            cycle_start_day: staffObj.salaryPayoutDay ? staffObj.salaryPayoutDay : null,
            cycle_start_date: staffObj.salaryPayoutDate ? staffObj.salaryPayoutDate : null,
            daily_shift_duration: staffObj.dailyShiftDuration ? staffObj.dailyShiftDuration : null,
            rule_group_id: defaultRuleGroup  ? defaultRuleGroup.id : null
        });
    }

    /**
     * Expected staffObj = {
     *      staffName: staffName, 
     *      countryCode: countryCode, 
     *      phone: phone,
     *      salaryType: salaryType,
     *      salary: salary, 
     *      salaryPayoutDate: salaryPayoutDate, 
     *      dailyShiftDuration: dailyShiftDuration, 
     *      salaryPayoutDay: salaryPayoutDay
     *  }
     */
    async updateStaff(refId, staffObj) {
        let salaryTypeTx = await taxonomyService.findTaxonomy("salary_type", staffObj.salaryType);
        
        return await models.staff.update({
            name: staffObj.staffName,
            country_code: staffObj.countryCode,
            phone: staffObj.phone,
            salary_type_txid: salaryTypeTx.id,
            salary: staffObj.salary ? staffObj.salary : null,
            cycle_start_day: staffObj.salaryPayoutDay ? staffObj.salaryPayoutDay : null,
            cycle_start_date: staffObj.salaryPayoutDate ? staffObj.salaryPayoutDate : null,
            daily_shift_duration: staffObj.dailyShiftDuration ? staffObj.dailyShiftDuration : null
        }, { where: { reference_id: refId }, returning: true });
    }

    async fetchStaff(staffId, isRefId) {
        if(isRefId) {
            return await models.staff.findOne({ where: { reference_id: staffId }, include: [ 
                { model: models.taxonomy, as: "salaryType" },
                { model: models.business } 
            ] });
        } else {
            return await models.staff.findOne({ where: { id: staffId }, include: [ 
                { model: models.taxonomy, as: "salaryType" },
                { model: models.business } 
            ] });
        }
    }

    async fetchStaffForBusinessId(businessId) {
        return await models.staff.findAll({ where: { business_id: businessId },
            order: [ [ "name", "asc" ] ],
            include: [ { model: models.taxonomy, as: "salaryType" },
                { model: models.business } ] });
    }

    async fetchPeriodDates(staff, date) {
        let startDate = null, endDate = null;
        if(["monthly", "daily", "hourly", "work_basis"].includes(staff.salaryType.value)) {
            /** Monthly Staff */
            startDate = moment(date).startOf("month");
            if (staff.cycle_start_date) {
                startDate.add(staff.cycle_start_date - 1, "days");
                if (startDate.isAfter(moment(date))) {
                    startDate.subtract(1, "months");
                }
            }
            endDate = moment(startDate).add(1, "month").subtract(1, "day");
        } else if (["weekly"].includes(staff.salaryType.value)) {
            /** Weekly Staff */
            startDate = moment(date).startOf("week");
            if (staff.cycle_start_day) {
                startDate.add(staff.cycle_start_day, "days");
                if (startDate.isAfter(moment(date))) {
                    startDate.subtract(1, "weeks");
                }
            }
            endDate = moment(startDate).add(1, "week").subtract(1, "day");
        }
        return {
            startDate: startDate,
            endDate: endDate
        };
    }
}