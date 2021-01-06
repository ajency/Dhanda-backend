'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("businesses", "ph_country_code", { type: Sequelize.INTEGER });
    await queryInterface.addColumn("businesses", "phone", { type: Sequelize.STRING });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("businesses", "ph_country_code");
    await queryInterface.removeColumn("businesses", "phone");
  }
};
