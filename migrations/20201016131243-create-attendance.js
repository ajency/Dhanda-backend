'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('attendances', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      staff_id: {
        type: Sequelize.INTEGER,
        references: {
          model: "staffs",
          key: "id"
        }
      },
      day_status_txid: {
        type: Sequelize.INTEGER,
        references: {
          model: "taxonomies",
          key: "id"
        }
      },
      date: {
        type: Sequelize.DATEONLY
      },
      punch_in_time: {
        type: Sequelize.TIME
      },
      punch_out_time: {
        type: Sequelize.TIME
      },
      overtime: {
        type: Sequelize.TIME
      },
      overtime_pay: {
        type: Sequelize.DECIMAL
      },
      late_fine_hours: {
        type: Sequelize.TIME
      },
      late_fine_amount: {
        type: Sequelize.DECIMAL
      },
      meta: {
        type: Sequelize.JSON
      },
      updated_by: {
        type: Sequelize.INTEGER,
        references: {
          model: "users",
          key: "id"
        }
      },
      source: {
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
    await queryInterface.dropTable('attendances');
  }
};