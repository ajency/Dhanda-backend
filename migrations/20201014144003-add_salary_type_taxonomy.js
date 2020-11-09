'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert("taxonomies", [
      {
        type: "salary_type",
        value: "monthly",
        default_label: "Monthly",
        active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        type: "salary_type",
        value: "daily",
        default_label: "Daily",
        active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        type: "salary_type",
        value: "hourly",
        default_label: "Hourly",
        active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        type: "salary_type",
        value: "work_basis",
        default_label: "Work Basis",
        active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        type: "salary_type",
        value: "weekly",
        default_label: "Weekly",
        active: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete("taxonomies", { [Sequelize.Op.or]: [
      { type: "salary_type", value: "monthly" },
      { type: "salary_type", value: "daily" },
      { type: "salary_type", value: "hourly" },
      { type: "salary_type", value: "work_basis" },
      { type: "salary_type", value: "weekly" }
    ] });
  }
};
