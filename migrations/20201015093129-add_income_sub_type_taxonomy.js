'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert("taxonomies", [
      {
        type: "income_sub_type",
        value: "esi",
        default_label: "ESI",
        active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        type: "income_sub_type",
        value: "pf",
        default_label: "PF",
        active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        type: "income_sub_type",
        value: "other",
        default_label: "Other",
        active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
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
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete("taxonomies", { [Sequelize.Op.or]: [
      { type: "income_sub_type", value: "esi" },
      { type: "income_sub_type", value: "pf" },
      { type: "income_sub_type", value: "other" },
      { type: "income_sub_type", value: "outstanding_balance" },
      { type: "income_sub_type", value: "pending_dues" }
    ] });
  }
};
