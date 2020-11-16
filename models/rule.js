'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class rule extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  };
  rule.init({
    name: DataTypes.STRING,
    rule_json: DataTypes.JSON,
    rule_group_id: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'rule',
    underscored: true,
  });
  return rule;
};