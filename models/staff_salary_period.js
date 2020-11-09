'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class staff_salary_period extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      this.belongsTo(models.staff, { foreignKey: "staff_id" });
      this.belongsTo(models.business, { foreignKey: "business_id" });
    }
  };
  staff_salary_period.init({
    business_id: DataTypes.INTEGER,
    staff_id: DataTypes.INTEGER,
    period_type: DataTypes.STRING,
    period_start: DataTypes.DATEONLY,
    period_end: DataTypes.DATEONLY,
    period_status: DataTypes.STRING,
    locked: DataTypes.BOOLEAN,
    total_present: DataTypes.INTEGER,
    total_paid_leave: DataTypes.INTEGER,
    total_half_day: DataTypes.INTEGER,
    total_absent: DataTypes.INTEGER,
    present_salary: DataTypes.DECIMAL,
    paid_leave_salary: DataTypes.DECIMAL,
    half_day_salary: DataTypes.DECIMAL,
    total_salary: DataTypes.DECIMAL,
    payslip_url: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'staff_salary_period',
    underscored: true,
  });
  return staff_salary_period;
};