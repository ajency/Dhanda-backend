'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('staffs', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      reference_id: {
        type: Sequelize.STRING
      },
      business_id: {
        type: Sequelize.INTEGER,
        references: {
          model: "businesses",
          key: "id"
        }
      },
      user_id: {
        type: Sequelize.INTEGER,
        references: {
          model: "users",
          key: "id"
        }
      },
      name: {
        type: Sequelize.STRING
      },
      country_code: {
        type: Sequelize.INTEGER
      },
      phone: {
        type: Sequelize.STRING
      },
      salary_type_txid: {
        type: Sequelize.INTEGER,
        references: {
          model: "taxonomies",
          key: "id"
        }
      },
      salary: {
        type: Sequelize.INTEGER
      },
      cycle_start_day: {
        type: Sequelize.INTEGER
      },
      cycle_start_date: {
        type: Sequelize.INTEGER
      },
      daily_shift_duration: {
        type: Sequelize.TIME
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
    await queryInterface.dropTable('staffs');
  }
};