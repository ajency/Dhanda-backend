'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert("taxonomies", [
      {
        type: "income_type",
        value: "pending_dues",
        default_label: "Pending Dues",
        active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        type: "income_type",
        value: "outstanding_balance",
        default_label: "Outstanding Balance",
        active: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);
    await queryInterface.bulkDelete("taxonomies", { [Sequelize.Op.or]: [
      { type: "income_sub_type", value: "outstanding_balance" },
      { type: "income_sub_type", value: "pending_dues" }
    ] });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete("taxonomies", { [Sequelize.Op.or]: [
      { type: "income_type", value: "outstanding_balance" },
      { type: "income_type", value: "bonus" }
    ] });
    await queryInterface.bulkInsert("taxonomies", [
      {
        type: "income_sub_type",
        value: "outstanding_balance",
        default_label: "Outstanding Balance",
        active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        type: "income_sub_type",
        value: "pending_dues",
        default_label: "Pending Dues",
        active: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);
  }
};
