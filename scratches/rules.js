var rules = [
    {
        condition: function (R) {
            R.when(["monthly", "weekly", "daily"].includes(this.salaryType) && ["present"].includes(this.status));
        },
        consequence: function (R) {
            this.salary += this.perDaySalary;
            this.presentSalary += this.perDaySalary;
            R.next();
        },
    },
    {
        condition: function (R) {
            R.when(["monthly", "weekly", "daily"].includes(this.salaryType) && ["paid_leave"].includes(this.status));
        },
        consequence: function (R) {
            this.salary += this.perDaySalary;
            this.paidLeaveSalary += this.perDaySalary;
            R.next();
        },
    },
    {
        condition: function (R) {
            R.when(["monthly", "weekly", "daily"].includes(this.salaryType) && ["half_day"].includes(this.status));
        },
        consequence: function (R) {
            this.salary += this.perDaySalary * 0.5;
            this.halfDaySalary += this.perDaySalary * 0.5;
            R.next();
        },
    },
    {
        condition: function (R) {
            R.when(["hourly"].includes(this.salaryType) && this.dayInMinutes);
        },
        consequence: function (R) {
            this.salary += this.dayInMinutes * this.perMinuteSalary;
            this.hourSalary += this.dayInMinutes * this.perMinuteSalary;
            R.next();
        },
    },
    {
        condition: function (R) {
            R.when(this.overtimeMinutes && this.overtimePayPerMinute);
        },
        consequence: function (R) {
            this.salary += this.overtimeMinutes * this.overtimePayPerMinute;
            this.overtimeSalary += this.overtimeMinutes * this.overtimePayPerMinute;
            R.next();
        },
    },
    {
        condition: function (R) {
            R.when(this.lateFineAmount && this.lateFineMinutes);
        },
        consequence: function (R) {
            this.salary -= (this.lateFineAmount + this.lateFineMinutes * this.perMinuteSalary);
            this.lateFineSalary -= (this.lateFineAmount + this.lateFineMinutes * this.perMinuteSalary);
            R.next();
        },
    },
    {
        condition: function (R) {
            R.when(!0);
        },
        consequence: function (R) {
            R.stop();
        },
    },
];


{
    "salaryType": "monthly",
    "status": "present",
    "perDaySalary": 1000,
    "dayInMinutes": 500,
    "perMinuteSalary": 10,
    "overtimeMinutes": 100,
    "overtimePayPerMinute": 100,
    "lateFineAmount": 100,
    "lateFineMinutes": 100
}

// example
test: (req, res) => {
    const RuleEngine = require("node-rules");
    /* Set of Rules to be applied
    First blocks a transaction if less than 500
    Second blocks a debit card transaction.*/
    /*Note that here we are not specifying which rule to apply first.
    Rules will be applied as per their index in the array.
    If you need to enforce priority manually, then see examples with prioritized rules */
    var rules = [{
        "condition": function(R) {
            console.log("Rule 1 ");
            R.when(["monthly", "weekly", "daily"].includes(this.salaryType) && ["present", "paid_leave"].includes(this.status));
        },
        "consequence": function(R) {
            this.result = true;
            this.salary += this.perDaySalary;
            R.next();//stop if matched. no need to process next rule.
        }
    }, {
        "condition": function(R) {
            console.log("Rule 2");
            R.when(["monthly", "weekly", "daily"].includes(this.salaryType) && ["half_day"].includes(this.status));
        },
        "consequence": function(R) {
            this.salary += this.perDaySalary * 0.5;
            R.next();
        }
    },
    {
        "condition": function(R) {
            console.log("Rule 3 " + (["hourly"].includes(this.salaryType)));
            R.when(["hourly"].includes(this.salaryType) && this.dayInMinutes);
        },
        "consequence": function(R) {
            this.salary += this.dayInMinutes * this.perMinuteSalary;
            R.next();
        }
    },
    {
        "condition": function(R) {
            console.log("Rule 4");
            R.when(this.overtimeMinutes && this.overtimePayPerMinute);
        },
        "consequence": function(R) {
            this.salary += this.overtimeMinutes * this.overtimePayPerMinute;
            R.next();
        }
    },
    {
        "condition": function(R) {
            console.log("Rule 5");
            R.when(this.lateFineAmount && this.lateFineMinutes);
        },
        "consequence": function(R) {
            this.salary -= (this.lateFineAmount + this.lateFineMinutes * this.perMinuteSalary);
            R.next();
        }
    },
    {
        "condition": function(R) {
            console.log("Rule 6");
            R.when(true); // stop once all rules have been checked
        },
        "consequence": function(R) {
            R.stop();
        }
    }
    ];
    /* Creating Rule Engine instance and registering rule */
    var R = new RuleEngine(rules, {"ignoreFactChanges": true});
    R.register(rules);
    /* Fact with more than 500 as transaction but a Debit card, and this should be blocked */
    var fact = {
        salaryType: "monthly",
        status: "present",
        perDaySalary: 1000,
        dayInMinutes: 500,
        perMinuteSalary: 10,
        overtimeMinutes: 100,
        overtimePayPerMinute: 100,
        lateFineAmount: 100,
        lateFineMinutes: 100,
        salary: 0,
        presentSalary: 0,
        paidLeaveSalary: 0,
        halfDaySalary: 0,
        hourSalary: 0,
        overtimeSalary: 0,
        lateFineSalary: 0
    };
    R.execute(fact, function(data) {
        console.log(">>>>>>>>>>>>> " + JSON.stringify(data))
        if (data.result) {
            console.log("Valid transaction");
        } else {
            console.log("Blocked Reason:" + data.reason);
        }
    });
},

// from and to json helper methods
function rulesToJSON(rules) {
    // var rules = this.rules;
    if (rules instanceof Array) {
        rules = rules.map(function(rule) {
            rule.condition = rule.condition.toString();
            rule.consequence = rule.consequence.toString();
            return rule;
        });
    } else if (typeof(rules) != "undefined") {
        rules.condition = rules.condition.toString();
        rules.consequence = rules.consequence.toString();
    }
    return rules;
};

function rulesFromJSON(rules) {
    if (typeof(rules) == "string") {
        rules = JSON.parse(rules);
    }
    if (rules instanceof Array) {
        rules = rules.map(function(rule) {
            rule.condition = eval("(" + rule.condition + ")");
            rule.consequence = eval("(" + rule.consequence + ")");
            return rule;
        });
    } else if (rules !== null && typeof(rules) == "object") {
        rules.condition = eval("(" + rules.condition + ")");
        rules.consequence = eval("(" + rules.consequence + ")");
    }
    return rules;
};

// -------------------------- default contoller file
test: (req, res) => {
    const RuleEngine = require("node-rules");
    /* Set of Rules to be applied
    First blocks a transaction if less than 500
    Second blocks a debit card transaction.*/
    /*Note that here we are not specifying which rule to apply first.
    Rules will be applied as per their index in the array.
    If you need to enforce priority manually, then see examples with prioritized rules */
    var rules = [{
        "condition": function(R) {
            console.log("Rule 1 ");
            R.when(["monthly", "weekly", "daily"].includes(this.salaryType) && ["present", "paid_leave"].includes(this.status));
        },
        "consequence": function(R) {
            this.result = true;
            this.salary += this.perDaySalary;
            R.next();//stop if matched. no need to process next rule.
        }
    }, {
        "condition": function(R) {
            console.log("Rule 2");
            R.when(["monthly", "weekly", "daily"].includes(this.salaryType) && ["half_day"].includes(this.status));
        },
        "consequence": function(R) {
            this.salary += this.perDaySalary * 0.5;
            R.next();
        }
    },
    {
        "condition": function(R) {
            console.log("Rule 3 " + (["hourly"].includes(this.salaryType)));
            R.when(["hourly"].includes(this.salaryType) && this.dayInMinutes);
        },
        "consequence": function(R) {
            this.salary += this.dayInMinutes * this.perMinuteSalary;
            R.next();
        }
    },
    {
        "condition": function(R) {
            console.log("Rule 4");
            R.when(this.overtimeMinutes && this.overtimePayPerMinute);
        },
        "consequence": function(R) {
            this.salary += this.overtimeMinutes * this.overtimePayPerMinute;
            R.next();
        }
    },
    {
        "condition": function(R) {
            console.log("Rule 5");
            R.when(this.lateFineAmount && this.lateFineMinutes);
        },
        "consequence": function(R) {
            this.salary -= (this.lateFineAmount + this.lateFineMinutes * this.perMinuteSalary);
            R.next();
        }
    },
    {
        "condition": function(R) {
            console.log("Rule 6");
            R.when(true); // stop once all rules have been checked
        },
        "consequence": function(R) {
            R.stop();
        }
    }
    ];

    let rulesJson = helperService.rulesToJSON([{condition:function(a){a.when(["monthly","weekly","daily"].includes(this.salaryType)&&["present","paid_leave"].includes(this.status))},consequence:function(a){this.salary+=this.perDaySalary;a.next()}},{condition:function(a){a.when(["monthly","weekly","daily"].includes(this.salaryType)&&["half_day"].includes(this.status))},consequence:function(a){this.salary+=this.perDaySalary*0.5;a.next()}},{condition:function(a){console.log("Rule 3 "+(["hourly"].includes(this.salaryType)));a.when(["hourly"].includes(this.salaryType)&&this.dayInMinutes)},consequence:function(a){this.salary+=this.dayInMinutes*this.perMinuteSalary;a.next()}},{condition:function(a){a.when(this.overtimeMinutes&&this.overtimePayPerMinute)},consequence:function(a){this.salary+=this.overtimeMinutes*this.overtimePayPerMinute;a.next()}},{condition:function(a){a.when(this.lateFineAmount&&this.lateFineMinutes)},consequence:function(a){this.salary-=(this.lateFineAmount+this.lateFineMinutes*this.perMinuteSalary);a.next()}},{condition:function(a){a.when(true)},consequence:function(a){a.stop()}}]);
    const models = require("../../models");
    models.rule.create({
        name: "1231",
        rule_json: rulesJson,
    });

    return res.send();


    /* Creating Rule Engine instance and registering rule */
    var R = new RuleEngine(rules, {"ignoreFactChanges": true});
    R.register(rules);
    /* Fact with more than 500 as transaction but a Debit card, and this should be blocked */
    var fact = {
        "salaryType": "monthly",
        "status": "present",
        "perDaySalary": 1000,
        "dayInMinutes": 500,
        "perMinuteSalary": 10,
        "overtimeMinutes": 100,
        "overtimePayPerMinute": 100,
        "lateFineAmount": 100,
        "lateFineMinutes": 100,
        "salary": 0
    };
    R.execute(fact, function(data) {
        console.log(">>>>>>>>>>>>> " + JSON.stringify(data))
        if (data.result) {
            console.log("Valid transaction");
        } else {
            console.log("Blocked Reason:" + data.reason);
        }
    });
},


test1: (req, res) => {
    let {Engine} = require("json-rules-engine");

    let engine = new Engine();
    
    // define a rule for detecting the player has exceeded foul limits.  Foul out any player who:
    // (has committed 5 fouls AND game is 40 minutes) OR (has committed 6 fouls AND game is 48 minutes)
    engine.addRule({
    conditions: {
        any: [{
        all: [{
            fact: 'gameDuration',
            operator: 'equal',
            value: 40
        }, {
            fact: 'personalFoulCount',
            operator: 'greaterThanInclusive',
            value: 5
        }]
        }, {
        all: [{
            fact: 'gameDuration',
            operator: 'equal',
            value: 48
        }, {
            fact: 'personalFoulCount',
            operator: 'greaterThanInclusive',
            value: 6
        }]
        }]
    },
    event: {  // define the event to fire when the conditions evaluate truthy
        type: 'fouledOut',
        params: {
        message: 'Player has fouled out!' + JSON.stringify(this)
        }
    }
    })
    
    /**
     * Define facts the engine will use to evaluate the conditions above.
     * Facts may also be loaded asynchronously at runtime; see the advanced example below
     */
    let facts = {
    personalFoulCount: 6,
    gameDuration: 40
    }
    
    // Run the engine to evaluate
    engine
    .run(facts)
    .then(results => {
        // 'results' is an object containing successful events, and an Almanac instance containing facts
        results.events.map(event => console.log(event.params.message))
    })
}