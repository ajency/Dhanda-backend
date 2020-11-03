const models = require("../models");

module.exports = class OrmService {
    /**
	*	query = string
	*	replacements = named parameter that are used in the query
	*
	*/
	async runRawSelectQuery(query, replacements) {
		return await models.sequelize.query(query, 
            {
                replacements: replacements,
                type: models.Sequelize.QueryTypes.SELECT
            }
        );
	}

	async updateModel(modelName, id, data) {
		return await models[modelName].update(data, { where: { id: id } });
	}

	async fetchModelById(modelName, id) {
		return await models[modelName].findOne({ where: { id: id } });
	}
}