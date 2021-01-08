'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("staff_salary_periods", "total_work_salary", { type: Sequelize.DECIMAL });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("staff_salary_periods", "total_work_salary");
  }
};
