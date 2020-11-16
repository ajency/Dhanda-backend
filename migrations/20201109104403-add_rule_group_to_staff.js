'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("staffs", "rule_group_id", {
      type: Sequelize.INTEGER,
      references: {
        model: "rule_groups",
        key: "id"
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("staffs", "rule_group_id");
  }
};
