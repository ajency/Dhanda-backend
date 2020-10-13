'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class business extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      business.hasOne(models.user, { foreignKey: "user_id" });
      business.hasOne(models.taxonomy, { foreignKey: "salary_month_txid" });
    }
  };
  business.init({
    user_id: DataTypes.INTEGER,
    name: DataTypes.STRING,
    currency: DataTypes.STRING,
    active: DataTypes.BOOLEAN,
    default: DataTypes.BOOLEAN,
    salary_month_txid: DataTypes.INTEGER,
    shift_hours: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'business',
    underscored: true,
  });
  return business;
};