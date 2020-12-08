'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("staff_income_meta", "deleted", { type: Sequelize.BOOLEAN, defaultValue: false });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("staff_income_meta", "deleted");
  }
};