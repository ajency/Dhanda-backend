'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class s3_file extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  };
  s3_file.init({
    type: DataTypes.STRING,
    slug: DataTypes.STRING,
    url: DataTypes.STRING
  }, {
    sequelize,
    modelName: 's3_file',
    underscored: true,
  });
  return s3_file;
};