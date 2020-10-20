const logger = require("simple-node-logger").createSimpleLogger({ timestampFormat:'YYYY-MM-DD HH:mm:ss.SSS' });
const models = require("../../models");
const taxonomyService = new (require("./TaxonomyService"));
const helperService = new (require("../HelperService"));

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
            reference_id: "S" + helperService.generateReferenceId(),
            business_id: businessId,
            name: staffObj.staffName,
            country_code: staffObj.countryCode,
            phone: staffObj.phone,
            salary_type_txid: salaryTypeTx.id,
            salary: staffObj.salary,
            cycle_start_day: staffObj.salaryPayoutDay,
            cycle_start_date: staffObj.salaryPayoutDate,
            daily_shift_duration: staffObj.dailyShiftDuration
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
            salary: staffObj.salary,
            cycle_start_day: staffObj.salaryPayoutDay,
            cycle_start_date: staffObj.salaryPayoutDate,
            daily_shift_duration: staffObj.dailyShiftDuration
        }, { where: { reference_id: refId }, returning: true });
    }

    async fetchStaff(staffId, isRefId) {
        if(isRefId) {
            return await models.staff.findOne({ where: { reference_id: staffId }, include: [ 
                { model: models.taxonomy },
                { model: models.business } 
            ] });
        } else {
            return await models.staff.findOne({ where: { id: staffId }, include: [ 
                { model: models.taxonomy },
                { model: models.business } 
            ] });
        }
    }

    async fetchStaffForBusinessId(businessId) {
        return await models.staff.findAll({ where: { business_id: businessId },
            include: [ { model: models.taxonomy, as: "salaryType" } ] });
    }
}