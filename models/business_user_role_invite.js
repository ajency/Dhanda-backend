'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class business_user_role_invite extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      this.belongsTo(models.role, {foreignKey: "role_id", as: "role" });
      this.belongsTo(models.user, { foreignKey: "invited_by", as: "invitedBy" });
    }
  };
  business_user_role_invite.init({
    reference_id: DataTypes.STRING,
    business_id: DataTypes.INTEGER,
    role_id: DataTypes.INTEGER,
    country_code: DataTypes.INTEGER,
    phone: DataTypes.STRING,
    name: DataTypes.STRING,
    accepted: DataTypes.BOOLEAN,
    deleted: DataTypes.BOOLEAN,
    invited_by: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'business_user_role_invite',
    underscored: true,
  });
  return business_user_role_invite;
};