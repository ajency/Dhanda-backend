'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('staffs', 'salary', { type: Sequelize.DECIMAL });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('staffs', 'salary', { type: Sequelize.BIGINT });
  }
};
