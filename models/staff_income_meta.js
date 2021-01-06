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
      this.belongsTo(models.taxonomy, { foreignKey: "income_type_txid", as: "income_type" });
      this.belongsTo(models.taxonomy, { foreignKey: "income_sub_type_txid", as: "income_sub_type" });
    }
  };
  staff_income_meta.init({
    staff_id: DataTypes.INTEGER,
    income_type_txid: DataTypes.INTEGER,
    income_sub_type_txid: DataTypes.INTEGER,
    date: DataTypes.DATEONLY,
    amount: DataTypes.DECIMAL,
    description: DataTypes.TEXT,
    reference_id: DataTypes.STRING,
    deleted: DataTypes.BOOLEAN
  }, {
    sequelize,
    modelName: 'staff_income_meta',
    underscored: true,
  });
  return staff_income_meta;
};