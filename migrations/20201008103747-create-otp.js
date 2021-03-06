'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('otps', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      country_code: {
        type: Sequelize.INTEGER
      },
      phone: {
        type: Sequelize.STRING
      },
      otp: {
        type: Sequelize.STRING
      },
      attempts: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      invalid: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      otp_type: {
        type: Sequelize.STRING
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('otps');
  }
};