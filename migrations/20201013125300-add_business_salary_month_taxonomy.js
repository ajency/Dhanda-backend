'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
    await queryInterface.bulkInsert("taxonomies", [
      {
        type: "business_salary_month",
        value: "calendar_month",
        default_label: "Calendar Month",
        active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        type: "business_salary_month",
        value: "30_days",
        default_label: "Every Month 30 Days",
        active: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);

  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete("taxonomies", { [Sequelize.Op.or]: [
      { type: "business_salary_month", value: "calendar_month" },
      { type: "business_salary_month", value: "30_days" }
    ] });
  }
};
