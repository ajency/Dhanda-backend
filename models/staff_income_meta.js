'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class staff_income_meta extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.belongsTo(models.staff, { foreignKey: "staff_id" });
      this.belongsTo(models.taxonomy, { foreignKey: "income_type_txid" });
      this.belongsTo(models.taxonomy, { foreignKey: "income_subtype_txid" });
    }
  };
  staff_income_meta.init({
    staff_id: DataTypes.INTEGER,
    income_type_txid: DataTypes.INTEGER,
    income_subtype_txid: DataTypes.INTEGER,
    amount: DataTypes.DECIMAL,
    description: DataTypes.TEXT
  }, {
    sequelize,
    modelName: 'staff_income_meta',
    underscored: true,
  });
  return staff_income_meta;
};