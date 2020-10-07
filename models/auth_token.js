'use strict';
module.exports = (sequelize, DataTypes) => {
  const auth_token = sequelize.define('auth_token', {
    user_id: DataTypes.INTEGER,
    token_id: DataTypes.STRING,
    type: DataTypes.STRING,
    invalid: DataTypes.BOOLEAN,
    valid_till: DataTypes.DATE
  }, {});
  auth_token.associate = function(models) {
    // associations can be defined here
    auth_token.belongsTo(models.user, {foreignKey: 'user_id', as: 'user'});
  };
  return auth_token;
};