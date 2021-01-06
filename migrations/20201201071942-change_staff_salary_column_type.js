'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('staffs', 'salary', { type: Sequelize.BIGINT });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('staffs', 'salary', { type: Sequelize.INTEGER });
  }
};
