'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn(
      'businesses',
      'timezone',
      {
        type: Sequelize.STRING
      }
    );
    await queryInterface.addColumn(
      'businesses',
      'country_code',
      {
        type: Sequelize.STRING
      }
    );
  },

  down: async (queryInterface, Sequelize) => {
    queryInterface.removeColumn('businesses', 'timezone');
    queryInterface.removeColumn('businesses', 'country_code');
  }
};
