'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class business_user_role extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.belongsTo(models.role, { foreignKey: "role_id", as: "role"});
      this.belongsTo(models.user, { foreignKey: "user_id", as: "user"});
      this.belongsTo(models.business, { foreignKey: "business_id", as: "business" });
    }
  };
  business_user_role.init({
    business_id: DataTypes.INTEGER,
    user_id: DataTypes.INTEGER,
    role_id: DataTypes.INTEGER,
    deleted: DataTypes.BOOLEAN
  }, {
    sequelize,
    modelName: 'business_user_role',
    underscored: true,
  });
  return business_user_role;
};