const logger = require("simple-node-logger").createSimpleLogger({ timestampFormat:'YYYY-MM-DD HH:mm:ss.SSS' });
const taxonomyService = new (require("./TaxonomyService"));
const models = require("../../models");

module.exports = class StaffIncomeMeta {
    async createStaffIncomeMeta(staffId, incomeTypeSlug, incomeSubTypeSlug, amount, description = null) {
        let incomeTypeTxId = null, incomeSubTypeTxId = null;
        if(incomeTypeSlug) {
            let incomeTypeTx = await taxonomyService.findTaxonomy("income_type", incomeTypeSlug);
            if(incomeTypeTx !== null) {
                incomeTypeTxId = incomeTypeTx.id;
            }
        }
        if(incomeSubTypeSlug) {
            let incomeSubTypeTx = await taxonomyService.findTaxonomy("income_sub_type", incomeSubTypeSlug);
            if(incomeSubTypeTx !== null) {
                incomeSubTypeTxId = incomeSubTypeTx.id;
            }
        }

        return models.staff_income_meta.create({
            staff_id: staffId,
            income_type_txid: incomeTypeTxId,
            income_sub_type_txid: incomeSubTypeTxId,
            amount: amount,
            description: description
        });
    }
}