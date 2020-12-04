const logger = require("simple-node-logger").createSimpleLogger({ timestampFormat:'YYYY-MM-DD HH:mm:ss.SSS' });
const taxonomyService = new (require("./TaxonomyService"));
const models = require("../../models");
const helperService = new (require("../HelperService"));
const Sequelize = require('sequelize');
const Op = Sequelize.Op;

module.exports = class StaffIncomeMeta {
    async createStaffIncomeMeta(staffId, incomeTypeSlug, incomeSubTypeSlug, amount, description = null, date = null) {
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

        return await models.staff_income_meta.create({
            reference_id: "SIM" + helperService.generateReferenceId(),
            staff_id: staffId,
            income_type_txid: incomeTypeTxId,
            income_sub_type_txid: incomeSubTypeTxId,
            date: date ? date : new Date(),
            amount: amount,
            description: description
        });
    }
    
    async updateOrCreateLatestStaffIncomeMeta(staffId, incomeTypeSlug, incomeSubTypeSlug, amount, description = null, referenceId = null, date = null) {
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

        // /** Fetch the latest staff income meta */
        // let latestStaffIncomeMeta = await models.staff_income_meta.findOne({ where: 
        //     { staff_id: staffId, income_type_txid: incomeTypeTxId },
        //     order: [ ['date', 'DESC'] ] });

        // TODO: remove above code once the outstanding balance change has been done

        /** Fetch the staff income meta by reference id */
        let staffIncomeMeta = null;
        if(referenceId) {
            staffIncomeMeta = await models.staff_income_meta.findOne({ reference_id: referenceId });
        }

        if(staffIncomeMeta) {
            let updateValues = {
                income_sub_type_txid: incomeSubTypeTxId,
                amount: amount,
                description: description
            };
            if(date) {
                updateValues.date = date;
            }
            return await models.staff_income_meta.update(updateValues, { where: { id: staffIncomeMeta.id }});
        } else {
            return await this.createStaffIncomeMeta(staffId, incomeTypeSlug, incomeSubTypeSlug, amount, description, date);
        }
    }

    /** To be used when there is only one entry for (incomeType, staffId) combination in staff income meta */
    async fetchStaffIncomeType(staffId, incomeType) {
        /** Fetch the income type taxonomy */
        let incomeTypeTx = await taxonomyService.findTaxonomy("income_type", incomeType);
        return await models.staff_income_meta.findOne({ where: { staff_id: staffId, income_type_txid: incomeTypeTx.id, deleted: false },
            include: [ { model: models.taxonomy, as: "income_type" } ] });
    }
    
    async fetchStaffPaymentsAggregate(staffId, startDate, endDate) {
        let payments = await this.fetchPaymentsForStaffBetween(staffId, startDate, endDate);
        let paymentTx = await taxonomyService.fetchTaxonomyForType("income_type");
        let paymentTxMap = new Map();
        for(let pt of paymentTx) {
            paymentTxMap.set(pt.id, pt.value);
        }

        let allowanceTotal = 0, bonusTotal = 0, paymentGivenTotal = 0, paymentTakenTotal = 0,
            loanGivenTotal = 0, loanRepayTotal = 0, deductionTotal = 0;
        for(let payment of payments) {
            switch(paymentTxMap.get(payment.income_type_txid)) {
                case "allowance":
                    allowanceTotal += parseFloat(payment.amount);
                    break;
                case "bonus":
                    bonusTotal += parseFloat(payment.amount);
                    break;
                case "payment_given":
                    paymentGivenTotal += parseFloat(payment.amount);
                    break;
                case "payment_taken":
                    paymentTakenTotal += parseFloat(payment.amount);
                    break;
                case "loan_given":
                    loanGivenTotal += parseFloat(payment.amount);
                    break;
                case "loan_repay":
                    loanRepayTotal += parseFloat(payment.amount);
                    break;
                case "deduction":
                    deductionTotal += parseFloat(payment.amount);
                    break;
                default:
            }
        }

        return {
            allowanceTotal: allowanceTotal,
            bonusTotal: bonusTotal,
            paymentGivenTotal: paymentGivenTotal,
            paymentTakenTotal: paymentTakenTotal,
            loanGivenTotal: loanGivenTotal,
            loanRepayTotal: loanRepayTotal,
            deductionTotal: deductionTotal
        }
    }

    async fetchPaymentsForStaffBetween(staffId, startDate, endDate) {
        let paymentTx = await taxonomyService.fetchTaxonomyForType("income_type");
        let paymentTxIds = paymentTx.map((p) => { return p.id } )
        return await models.staff_income_meta.findAll({ where: { 
                staff_id: staffId,
                date: { [Op.between]: [startDate, endDate] },
                income_type_txid: { [Op.in]: paymentTxIds }
            }, include: [ { model: models.taxonomy, as: "income_type" }]
        });
    }
}