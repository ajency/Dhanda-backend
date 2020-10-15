'use strict';
module.exports = (sequelize, DataTypes) => {
  const global_defaults = sequelize.define('global_defaults', {
    type: DataTypes.STRING,
    value: DataTypes.STRING,
    meta: DataTypes.TEXT
  }, {
    underscored: true
  });
  global_defaults.associate = function(models) {
    // associations can be defined here
  };
  return global_defaults;
};