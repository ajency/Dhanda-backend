const logger = require("simple-node-logger").createSimpleLogger({ timestampFormat:'YYYY-MM-DD HH:mm:ss.SSS' });
const models = require("../../models");
const taxonomyService = new (require("./TaxonomyService"));

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
     *      salaryPayoutDay: salaryPayoutDay
     *  }
     */
    async createStaff(businessId, staffObj) {
        let salaryTypeTx = await taxonomyService.findTaxonomy("salary_type", staffObj.salaryType);
        
        return await models.staff.create({
            business_id: businessId,
            name: staffObj.staffName,
            country_code: staffObj.countryCode,
            phone: staffObj.phone,
            salary_type_txid: salaryTypeTx.id,
            salary: staffObj.salary,
            cycle_start_day: staffObj.salaryPayoutDay,
            cycle_start_date: staffObj.salaryPayoutDate,
            daily_shift_duration: staffObj.dailyShiftDuration
        })
    }
}