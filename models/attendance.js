'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class attendance extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.belongsTo(models.staff, { foreignKey: "staff_id", as: "staff" });
      this.belongsTo(models.taxonomy, { foreignKey: "day_status_txid", as: "dayStatus" });
      this.belongsTo(models.user, { foreignKey: "updated_by", as: "updatedByUser" });
    }
  };
  attendance.init({
    staff_id: DataTypes.INTEGER,
    day_status_txid: DataTypes.INTEGER,
    date: DataTypes.DATEONLY,
    punch_in_time: DataTypes.TIME,
    punch_out_time: DataTypes.TIME,
    overtime: DataTypes.TIME,
    overtime_pay: DataTypes.DOUBLE,
    late_fine_hours: DataTypes.TIME,
    late_fine_amount: DataTypes.DECIMAL,
    meta: DataTypes.JSON,
    updated_by: DataTypes.INTEGER,
    source: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'attendance',
    underscored: true,
  });
  return attendance;
};