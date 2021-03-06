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
        value: "current_balance",
        default_label: "Current Balance",
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
      { type: "income_type", value: "current_balance" }
    ] });
  }
};
