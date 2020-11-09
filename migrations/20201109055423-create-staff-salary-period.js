'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('staff_salary_periods', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      business_id: {
        type: Sequelize.INTEGER,
        references: {
          model: "businesses",
          key: "id"
        }
      },
      staff_id: {
        type: Sequelize.INTEGER,
        references: {
          model: "staffs",
          key: "id"
        }
      },
      period_type: {
        type: Sequelize.STRING
      },
      period_start: {
        type: Sequelize.DATEONLY
      },
      period_end: {
        type: Sequelize.DATEONLY
      },
      period_status: {
        type: Sequelize.STRING
      },
      locked: {
        type: Sequelize.BOOLEAN
      },
      total_present: {
        type: Sequelize.INTEGER
      },
      total_paid_leave: {
        type: Sequelize.INTEGER
      },
      total_half_day: {
        type: Sequelize.INTEGER
      },
      total_absent: {
        type: Sequelize.INTEGER
      },
      present_salary: {
        type: Sequelize.DECIMAL
      },
      paid_leave_salary: {
        type: Sequelize.DECIMAL
      },
      half_day_salary: {
        type: Sequelize.DECIMAL
      },
      total_salary: {
        type: Sequelize.DECIMAL
      },
      payslip_url: {
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
    await queryInterface.dropTable('staff_salary_periods');
  }
};