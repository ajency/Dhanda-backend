'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class taxonomy_label extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      taxonomy_label.hasOne(models.business, { foreignKey: "business_id" });
      taxonomy_label.hasOne(models.taxonomy, { foreignKey: "taxonomy_id" });
    }
  };
  taxonomy_label.init({
    business_id: DataTypes.INTEGER,
    taxonomy_id: DataTypes.INTEGER,
    label: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'taxonomy_label',
    underscored: true,
  });
  return taxonomy_label;
};