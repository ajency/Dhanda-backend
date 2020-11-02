'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class user extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.hasMany(models.business, { foreignKey: "user_id", as: "businesses" });
      this.hasMany(models.business_user_role, { foreignKey: "user_id", as: "businessUserRoles" });
    }
  };
  user.init({
    reference_id: DataTypes.STRING,
    name: DataTypes.STRING,
    country_code: DataTypes.INTEGER,
    phone: DataTypes.STRING,
    lang: DataTypes.STRING,
  }, {
    sequelize,
    modelName: 'user',
    underscored: true,
  });
  return user;
};