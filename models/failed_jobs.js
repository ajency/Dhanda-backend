'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class failed_jobs extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  };
  failed_jobs.init({
    queue: DataTypes.STRING,
    payload: DataTypes.JSON
  }, {
    sequelize,
    modelName: 'failed_jobs',
    underscored: true,
  });
  return failed_jobs;
};