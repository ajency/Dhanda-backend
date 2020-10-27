'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert("taxonomies", [
      {
        type: "day_status",
        value: "present",
        default_label: "Present",
        active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        type: "day_status",
        value: "absent",
        default_label: "Absent",
        active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        type: "day_status",
        value: "half_day",
        default_label: "Half Day",
        active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        type: "day_status",
        value: "paid_leave",
        default_label: "Paid Holiday",
        active: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete("taxonomies", { [Sequelize.Op.or]: [
      { type: "day_status", value: "present" },
      { type: "day_status", value: "absent" },
      { type: "day_status", value: "half_day" },
      { type: "day_status", value: "paid_leave" }
    ] });
  }
};
