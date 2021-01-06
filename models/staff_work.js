'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class staff_work extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      this.belongsTo(models.staff, { foreignKey: "staff_id", as: "staff" });
    }
  };
  staff_work.init({
    reference_id: DataTypes.STRING,
    staff_id: DataTypes.INTEGER,
    date: DataTypes.DATE,
    type: DataTypes.STRING,
    rate: DataTypes.DECIMAL,
    units: DataTypes.INTEGER,
    total: DataTypes.DECIMAL,
    deleted: DataTypes.BOOLEAN
  }, {
    sequelize,
    modelName: 'staff_work',
    underscored: true,
  });
  return staff_work;
};