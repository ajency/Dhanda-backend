const models = require("../../models");
const RuleEngine = require("node-rules");
const helperService = new (require("../HelperService"));

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

    /**
     * To use this method, you will have to incorporate the doAction variable in the rule (as done in force_user_verify)
     * @param {*} ruleName 
     * @param {*} facts 
     * @param {*} ruleGroupId 
     */
    async executeRuleFor(ruleName, facts, ruleGroupId) {
        if(!ruleGroupId) {
            /** Fetch the default rule group */
            let defaultRuleGroup = await models.rule_group.findOne({ where: { name: "default", business_id: null } });
            ruleGroupId = defaultRuleGroup.id;
        }

        let rule = await this.fetchRuleByNameAndGroup(ruleName, ruleGroupId);

        let ruleRes = await this.executeRule(helperService.rulesFromJSON(rule.rule_json), facts);
        if(ruleRes) {
            return (ruleRes.doAction) ? true : false;
        } else {
            return false;
        }
    }
}