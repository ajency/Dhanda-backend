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
  },

  down: async (queryInterface, Sequelize) => {
    queryInterface.removeColumn('businesses', 'timezone')
  }
};
