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
}