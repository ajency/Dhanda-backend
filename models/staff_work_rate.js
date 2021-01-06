'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class staff_work_rate extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      this.belongsTo(models.staff, { foreignKey: "staff_id", as: "staff" });
    }
  };
  staff_work_rate.init({
    staff_id: DataTypes.INTEGER,
    type: DataTypes.STRING,
    rate: DataTypes.DECIMAL
  }, {
    sequelize,
    modelName: 'staff_work_rate',
    underscored: true,
  });
  return staff_work_rate;
};