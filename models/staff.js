'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class staff extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.belongsTo(models.business, { foreignKey: "business_id" });
      this.belongsTo(models.user, { foreignKey: "user_id" });
      this.belongsTo(models.taxonomy, { foreignKey: "salary_type_txid", as: "salaryType" });
    }
  };
  staff.init({
    reference_id: DataTypes.STRING,
    business_id: DataTypes.INTEGER,
    user_id: DataTypes.INTEGER,
    name: DataTypes.STRING,
    country_code: DataTypes.INTEGER,
    phone: DataTypes.STRING,
    salary_type_txid: DataTypes.INTEGER,
    salary: DataTypes.INTEGER,
    cycle_start_day: DataTypes.INTEGER,
    cycle_start_date: DataTypes.INTEGER,
    daily_shift_duration: DataTypes.TIME,
    rule_group_id: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'staff',
    underscored: true,
  });
  return staff;
};