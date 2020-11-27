'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("staffs", "disabled", { type: Sequelize.BOOLEAN, defaultValue: false });
    await queryInterface.addColumn("staffs", "deleted", { type: Sequelize.BOOLEAN, defaultValue: false });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("staffs", "disabled");
    await queryInterface.removeColumn("staffs", "deleted");
  }
};
