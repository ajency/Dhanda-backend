'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert("global_defaults", [
      {
        type: "cold_start_api_defaults",
        value: null,
        meta: JSON.stringify({
          minAppVersion: "0.0.1",
          recAppVersion: "0.0.1",
          langLastUpdated: "2020-10-15 00:00:00"
        }),
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete("global_defaults", { type: "cold_start_api_defaults" });
  }
};
