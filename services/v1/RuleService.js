const models = require("../../models");
const RuleEngine = require("node-rules");

module.exports = class RuleService {
    async fetchRuleByNameAndGroup(ruleName, ruleGroupId) {
        return await models.rule.findOne({ where: { name: ruleName, rule_group_id: ruleGroupId } });
    }

    async executeRule(ruleJson, fact) {
        return new Promise((resolve, reject) => {
            let R = new RuleEngine(ruleJson, { ignoreFactChanges: true });
            R.execute(fact, (data) => {
                resolve(data);
            });
        });
    }
}