const logger = require("simple-node-logger").createSimpleLogger({ timestampFormat:'YYYY-MM-DD HH:mm:ss.SSS' });
const moment = require("moment");
const businessService = new (require("../../services/v1/BusinessService"));
const staffService = new (require("../../services/v1/StaffService"));
const attendanceService = new (require("../../services/v1/AttendanceService"));

module.exports = {
    fetchStaffAttendance: async (req, res) => {
        try {
            let { businessRefId } = req.params;

            /** Fetch the business by reference id */
            let business = await businessService.fetchBusinessById(businessRefId, true);
            if(!business) {
                return res.status(200).send({ code: "error", message: "business_not_found" });
            }

            /** Check if the date is passed, if not then take the current date in the business timezone */
            let { date } = req.query;
            if(!date) {
                let timezone = business.timezone;
                if(!business.timezone) {
                    timezone = "+00:00";
                }
                date = moment().tz(timezone).format("YYYY-MM-DD");
            }

            let data = {
                date: date,
                businessName: business.name,
                shiftHours: business.shift_hours,
                currency: business.currency,
                staffSummary: {},
                monthlyStaff: [],
                hourlyStaff: []
            }

            /** Fetch all the staff memebers of this business */
            let staffMembers = await staffService.fetchStaffForBusinessId(business.id);

            if(staffMembers.length === 0) {
                res.status(200).send({ code: "success", message: "success", data: data });
            }

            /** Fetch available attendance for the staff */
            let staffIds = staffMembers.map((staffMember) => { return staffMember.id });
            let staffAttendance = await attendanceService.fetchAttendanceByStaffIdsAndDate(staffIds, date);

            /** Fetch the default start time for hourly staff */
            let hourlyStaffIds = [];
            for(let staffMember of staffMembers) { 
                if(staffMember.salaryType.value === "hourly") { 
                    hourlyStaffIds.push(staffMember.id);
                }
            }
            let latestPunchInTimes = await attendanceService.fetchLatestPunchInTimeFor(hourlyStaffIds);

            /** Generate default punch in time map */
            let defaultPunchInMap = new Map();
            for(let punchIn of latestPunchInTimes) {
                defaultPunchInMap.set(punchIn.staff_id, punchIn.punch_in_time);
            }

            /** Generate the attendance map for this business */
            let attendanceMap = new Map();
            for(let sa of staffAttendance) {
                attendanceMap.set(sa.staff_id, sa);
            }

            /** Look through the staff members and generate the response */
            let monthlyStaff = [], hourlyStaff = [];
            let presentTotal = 0,  absentTotal = 0, halfDayTotal = 0, paidHolidayTotal = 0;
            for(let staff of staffMembers) {
                let staffRes = {};
                let att = attendanceMap.get(staff.id);

                if(att) {
                    /** Calculate the hours */
                    let hours = "";
                    if(staff.salaryType.value === "hourly") {
                        if(att.punch_in_time && att.punch_out_time) {
                            let duration = moment(att.punch_in_time).diff(att.punch_out_time);
                            hours = duration.asHours() + ":" + (duration.asMinutes() % 60) + ":" + (duration.asSeconds() % 60);
                        }
                    } else {
                        hours = business.shiftHours;
                    }

                    /** Update aggregate data */
                    switch(att.dayStatus.value) {
                        case "present":
                            presentTotal += 1;
                            break;
                        case "absent":
                            absentTotal += 1;
                            break;
                        case "half_day":
                            halfDayTotal += 1;
                            break;
                        case "paid_holiday":
                            paidHolidayTotal += 1;
                            break;
                        default:
                            break;
                    }

                    staffRes = {
                        name: staff.name,
                        hours: hours,
                        overtime: att.overtime ? att.overtime : "",
                        lateFine: att.lateFine ? att.lateFine : "",
                        status: att.dayStatus ? att.dayStatus.value : "",
                        note: att.meta.note ? att.meta.note : "",
                        punchIn: att.punch_in_time,
                        punchOut: att.punch_out_time,
                        defaultPunchIn: defaultPunchInMap.has(staff.id) ? defaultPunchInMap.get(staff.id) : null
                    }
                } else {
                    staffRes = {
                        name: staff.name,
                        hours: "",
                        overtime: "",
                        lateFine: "",
                        status: "",
                        note: "",
                        defaultPunchIn: defaultPunchInMap.has(staff.id) ? defaultPunchInMap.get(staff.id) : null
                    }
                }

                if(staff.salaryType.value === "hourly") {
                    hourlyStaff.push(staffRes);
                } else {
                    monthlyStaff.push(staffRes);
                }
            }

            /** Populate the response */
            data.staffStatusSummary = {
                present: presentTotal,
                absent: absentTotal,
                halfDay: halfDayTotal,
                paidHoliday: paidHolidayTotal
            };
            data.monthlyStaff = monthlyStaff;
            data.hourlyStaff = hourlyStaff;

            return res.status(200).send({ code: "success", message: "success", data: data });
        } catch(err) {
            await logger.error("Exception in fetch staff attendance api: ", err);
            return res.status(200).send({ code: "error", message: "error" });
        }
    }
}