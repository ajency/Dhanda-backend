const logger = require("simple-node-logger").createSimpleLogger({ timestampFormat:'YYYY-MM-DD HH:mm:ss.SSS' });
const models = require("../../models");

module.exports = class TaxonomyService {
    async fetchTaxonomyForType(type, onlyActive = false) {
        let whereClause = { type: type };
        if(onlyActive) {
            whereClause.active = true
        }
        
        let taxonomies = await models.taxonomy.findAll({ where: whereClause });
        return taxonomies;
    }

    async findTaxonomy(type, value) {
        return await models.taxonomy.findOne({ where: { type: type, value: value } });
    }

    async findTaxonomyById(id) {
        if(!id) {
            return null;
        }
        return await models.taxonomy.findOne({ where: { id: id } });
    }
}