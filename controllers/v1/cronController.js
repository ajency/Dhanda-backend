const logger = require("simple-node-logger").createSimpleLogger({ timestampFormat:'YYYY-MM-DD HH:mm:ss.SSS' });
const moment = require("moment");
const businessService = new (require("../../services/v1/BusinessService"));
const attendanceService = new (require("../../services/v1/AttendanceService"));

module.exports = {
    populateDailyAttendanceAndPayroll: async (req = null,res = null) => {
        try {
            /** Fetch all distinct timezones */
            let distinctTimezones = await businessService.fetchDistinctBusinessTimezones();

            for(let timezone of distinctTimezones) {
                if(moment().utcOffset(timezone.timezone).format("HH:mm") === "00:00") {
                    date = moment().utcOffset(timezone.timezone).format("YYYY-MM-DD");
                    /** Fetch the businesses based on the timezone */
                    let businesses = await businessService.fetchBusinessByTimezone(timezone.timezone);

                    /** Loop through each business */
                    for(let business of businesses) {
                        await logger.info("Populating daily attendance for business id: " + business.id);
                        await attendanceService.populateStaffAttendanceFor(business, date);
                    }
                    for(let business of businesses) {
                        await logger.info("Updating payroll for business id: " + business.id);
                        await attendanceService.updateStaffPayrollFor(business, date);
                    }
                }
            }
            if(res) {
                return res.status(200).send({ code: "success", message: "success" });
            } else return;
        } catch(err) {
            await logger.error("Exception in fetch staff api: ", err);
            if(res) {
                return res.status(200).send({ code: "error", message: "error" });
            } else return;
        }
    }
}