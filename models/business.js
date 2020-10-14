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
      this.belongsTo(models.user, { foreignKey: "user_id" });
      this.hasMany(models.taxonomy_label, { foreignKey: "business_id" });
    }
  };
  business.init({
    reference_id: DataTypes.STRING,
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