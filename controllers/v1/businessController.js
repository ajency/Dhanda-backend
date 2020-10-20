const logger = require("simple-node-logger").createSimpleLogger({ timestampFormat:'YYYY-MM-DD HH:mm:ss.SSS' });
const moment = require("moment");
const helperService = new (require("../../services/HelperService"));
const businessService = new (require("../../services/v1/BusinessService"));
const userService = new (require("../../services/v1/UserService"));
const staffService = new (require("../../services/v1/StaffService"));
const attendanceService = new (require("../../services/v1/AttendanceService"));

module.exports = {
    saveBusiness: async (req, res) => {
        try {
            /** Validate Request */
            let requestValid = helperService.validateRequiredRequestParams(req.body, 
                    [ "owner", "businessName", "currency", "salaryMonthType", "shiftHours" ]);
            if(!requestValid) {
                return res.status(200).send({ code: "error", message: "missing_params" });
            }

            let { refId, owner, businessName, currency, salaryMonthType, shiftHours } = req.body;

            /** Create a new business */
            let businessObj = {
                name: businessName,
                currency: currency,
                salaryMonthType: salaryMonthType,
                shiftHours: shiftHours
            } 

            if(!refId) {
                /** Create a new business */
                let business = await businessService.createBusinessForUser(req.user, businessObj);
            
                /** Update the user's name */
                await userService.updateUser({ name: owner }, req.user);
                
                let data = {
                    refId: business.reference_id
                }
                return res.status(200).send({ code: "add_staff", message: "success", data: data });
            } else {
                /** Update the business */
                let updateCount = await businessService.updateBusiness(refId, businessObj);
                if(updateCount[0] === 0) {
                    return res.status(200).send({ code: "error", message: "business_not_found" });
                }
                return res.status(200).send({ code: "success", message: "success" });
            }

            
        } catch(err) {
            await logger.error("Exception in add business api: ", err);
            return res.status(200).send({ code: "error", message: "error" });
        }
    },

    fetchBusiness: async (req, res) => {
        try {
            let { refId } = req.query;

            let business = null;
            if(!refId) {
                /** Fetch the default business of the user */
                business = await userService.fetchDefaultBusinessForUser(req.user);
            } else {
                business = await businessService.fetchBusinessById(refId, true);
            }

            if(business === null) {
                return res.status(200).send({ code: "error", message: "business_not_found" });
            }

            let data = {
                "refId": business.reference_id,                                 
                "owner": business.user.name,                     
                "businessName": business.name,
                "currency": business.currency,
                "salaryMonthType": business.taxonomy.value,
                "shiftHours": business.shiftHours
            }

            return res.status(200).send({ code: "success", message: "success", data: data });
        } catch(err) {
            await logger.error("Exception in fetch business api: ", err);
            return res.status(200).send({ code: "error", message: "error" });
        }
    },

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
                        punchOut: att.punch_out_time
                    }
                } else {
                    staffRes = {
                        name: staff.name,
                        hours: "",
                        overtime: "",
                        lateFine: "",
                        status: "",
                        note: ""
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