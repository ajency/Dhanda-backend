'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert("taxonomies", [
      {
        type: "income_type",
        value: "allowance",
        default_label: "Allowance",
        active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        type: "income_type",
        value: "bonus",
        default_label: "Bonus",
        active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        type: "income_type",
        value: "deduction",
        default_label: "Deduction",
        active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        type: "income_type",
        value: "payment_given",
        default_label: "Payment Given",
        active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        type: "income_type",
        value: "payment_taken",
        default_label: "Payment Taken",
        active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        type: "income_type",
        value: "loan_given",
        default_label: "Loan Given",
        active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        type: "income_type",
        value: "loan_repay",
        default_label: "Loan Repay",
        active: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete("taxonomies", { [Sequelize.Op.or]: [
      { type: "income_type", value: "allowance" },
      { type: "income_type", value: "bonus" },
      { type: "income_type", value: "deduction" },
      { type: "income_type", value: "payment_given" },
      { type: "income_type", value: "payment_taken" },
      { type: "income_type", value: "loan_given" },
      { type: "income_type", value: "loan_repay" }
    ] });
  }
};
