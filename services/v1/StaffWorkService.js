const models = require("../../models");
const helperService = new (require("../HelperService"));

module.exports = class StaffWorkService {
    async fetchStaffWorkByRefId(refId) {
        return await models.staff_work.findOne({ where: { reference_id: refId, deleted: false } });
    }
    
    async saveOrUpdateStaffWork(staffWorkObj, refId) {
        if(refId) {
            /** Update the staff work object */
            await models.staff_work.update(staffWorkObj, { where: { reference_id: refId } });
        } else {
            /** Create a new entry */
            staffWorkObj.reference_id = "SW" + helperService.generateReferenceId();
            await models.staff_work.create(staffWorkObj);
        }
    }

    async deleteStaffWork(refId) {
        await models.staff_work.update({ deleted: true }, { where: { reference_id: refId } });
    }

    async fetchStaffWorkRateByRefId(refId) {
        return await models.staff_work_rate.findOne({ where: { reference_id: refId, deleted: false } });
    }
    
    async saveOrUpdateStaffWorkRate(staffWorkRateObj, refId) {
        if(refId) {
            /** Update the staff work object */
            await models.staff_work_rate.update(staffWorkRateObj, { where: { reference_id: refId } });
        } else {
            /** Create a new entry */
            staffWorkRateObj.reference_id = "SWR" + helperService.generateReferenceId();
            await models.staff_work_rate.create(staffWorkRateObj);
        }
    }

    async deleteStaffWorkRate(refId) {
        await models.staff_work_rate.update({ deleted: true }, { where: { reference_id: refId } });
    }

    async fetchStaffWorkRatesByStaffId(staffId) {
        return await models.staff_work_rate.findAll({ where: { staff_id: staffId, deleted: false } });
    }

    async fetchStaffWorkByStaffId(staffId) {
        return await models.staff_work.findAll({ where: { staff_id: staffId, deleted: false } });
    }
}