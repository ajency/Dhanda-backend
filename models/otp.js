'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class otp extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  };
  otp.init({
    phone: DataTypes.INTEGER,
    otp: DataTypes.STRING,
    attempts: DataTypes.INTEGER,
    invalid: DataTypes.BOOLEAN,
    otp_type: DataTypes.STRING,
    created_at: DataTypes.DATE
  }, {
    sequelize,
    modelName: 'otp',
    underscored: true,
  });
  return otp;
};