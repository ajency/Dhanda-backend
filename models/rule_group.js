'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class rule_group extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  };
  rule_group.init({
    name: DataTypes.STRING,
    business_id: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'rule_group',
    underscored: true,
  });
  return rule_group;
};