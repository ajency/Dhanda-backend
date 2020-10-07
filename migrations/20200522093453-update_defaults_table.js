'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.bulkInsert('global_defaults', [{
        data_type: 'refresh_token',
        data_value: '',
        createdAt: new Date(),
        updatedAt: new Date()
      }, {
        data_type: 'access_token',
        data_value: '',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        data_type: 'minimum_app_version',
        data_value: '0.0.1',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        data_type: 'recomended_app_version',
        data_value: '0.0.1',
        createdAt: new Date(),
        updatedAt: new Date()
      }]);
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.bulkDelete('global_defaults', null, {});
  }
};

