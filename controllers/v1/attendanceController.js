const logger = require("simple-node-logger").createSimpleLogger({ timestampFormat:'YYYY-MM-DD HH:mm:ss.SSS' });
const moment = require("moment");
const businessService = new (require("../../services/v1/BusinessService"));
const staffService = new (require("../../services/v1/StaffService"));
const attendanceService = new (require("../../services/v1/AttendanceService"));
const helperService = new (require("../../services/HelperService"));
const taxonomyService = new (require("../../services/v1/TaxonomyService"));
const awsService = new (require("../../services/AwsService"));

module.exports = {
    fetchBusinessStaffAttendance: async (req, res) => {
        try {
            let { businessRefId } = req.params;

            /** Fetch the business by reference id */
            let business = await businessService.fetchBusinessById(businessRefId, true);
            if(!business) {
                await logger.info("Fetch staff attendance - business not found: " + businessRefId);
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
                staffStatusSummary: {},
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
                            let durationHours = "00" + moment(moment().format("YYYY-MM-DD ") + att.punch_out_time)
                                        .diff(moment().format("YYYY-MM-DD ") + att.punch_in_time, 'hour');
                            let durationMinutes = "00" + (moment(moment().format("YYYY-MM-DD ") + att.punch_out_time)
                                                .diff(moment().format("YYYY-MM-DD ") + att.punch_in_time, 'minute')) % 60;
                            let durationSeconds = "00" + (moment(moment().format("YYYY-MM-DD ") + att.punch_out_time)
                                                .diff(moment().format("YYYY-MM-DD ") + att.punch_in_time, 'second')) % 60;
                            hours =  durationHours.slice(-2) + ":" + durationMinutes.slice(-2) + ":" + durationSeconds.slice(-2);
                            /** Update present total if hourly staff has both start time and end time */
                            presentTotal += 1;
                        } else {
                            absentTotal += 1;
                        }
                    } else if(staff.salaryType.value !== "work_basis") {
                        if(att.dayStatus && att.dayStatus.value === "half_day") {
                            hours = helperService.getHalfDayHours(staff.daily_shift_duration);
                        } else if(att.dayStatus && att.dayStatus.value === "absent") {
                            hours = "00:00";
                        } else {
                            hours = staff.daily_shift_duration;
                        }
                    }

                    /** Update aggregate data */
                    if(att.dayStatus) {
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
                            case "paid_leave":
                                paidHolidayTotal += 1;
                                break;
                            default:
                                break;
                        }
                    }

                    staffRes = {
                        refId: staff.reference_id,
                        name: staff.name,
                        countryCode: staff.country_code,
                        phone: staff.phone,
                        hours: hours ? hours : "",
                        overtime: att.overtime ? att.overtime : "",
                        overtimePay: att.overtime_pay ? att.overtime_pay : "",
                        lateFineHours: att.late_fine_hours ? att.late_fine_hours : "",
                        lateFineAmount: att.late_fine_amount ? att.late_fine_amount : "",
                        status: att.dayStatus ? att.dayStatus.value : "",
                        note: (att.meta && att.meta.note) ? att.meta.note : "",
                        punchIn: att.punch_in_time,
                        punchOut: att.punch_out_time,
                        defaultPunchIn: defaultPunchInMap.has(staff.id) ? defaultPunchInMap.get(staff.id) : null
                    }

                    if(staff.salaryType.value === "hourly") {
                        hourlyStaff.push(staffRes);
                    } else {
                        monthlyStaff.push(staffRes);
                    }
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
    },

    saveDayStatus: async (req,res) => {
        try {
            /** Validate Request */
            let requestValid = helperService.validateRequiredRequestParams(req.body, 
                    [ "date" ]);
            if(!requestValid) {
                await logger.info("Save day status - missing params");
                return res.status(200).send({ code: "error", message: "missing_params" });
            }

            let { staffRefId } = req.params;

            /** Check if the staff exists */
            let staff = await staffService.fetchStaff(staffRefId, true);
            if(staff === null) {
                await logger.info("Save day status - staff not found: " + staffRefId);
                return res.status(200).send({ code: "error", message: "staff_not_found" });
            }

            let { date, status, punchIn, punchOut } = req.body;
            let params = {
                dayStatus: status,
                punchIn: punchIn,
                punchOut: punchOut,
                updatedBy: req.user,
                source: "user-action"
            }

            /** Populate the data object */
            let attendanceRecord = await attendanceService.createOrUpdateAttendance(staff.id, date, params);
            
            /** Put a job in update salary queue */
            awsService.addUpdateSalaryJob({ staffId: staff.id, date: date });
            
            let dayStatusObj = await taxonomyService.findTaxonomyById(attendanceRecord.day_status_txid);
            let hours = "";
            if(staff.salaryType.value === "hourly") {
                if(attendanceRecord.punch_in_time && attendanceRecord.punch_out_time) {
                    let durationHours = "00" + moment(moment().format("YYYY-MM-DD ") + attendanceRecord.punch_out_time)
                                        .diff(moment().format("YYYY-MM-DD ") + attendanceRecord.punch_in_time, 'hour');
                    let durationMinutes = "00" + (moment(moment().format("YYYY-MM-DD ") + attendanceRecord.punch_out_time)
                                        .diff(moment().format("YYYY-MM-DD ") + attendanceRecord.punch_in_time, 'minute')) % 60;
                    let durationSeconds = "00" + (moment(moment().format("YYYY-MM-DD ") + attendanceRecord.punch_out_time)
                                        .diff(moment().format("YYYY-MM-DD ") + attendanceRecord.punch_in_time, 'second')) % 60;
                    hours =  durationHours.slice(-2) + ":" + durationMinutes.slice(-2) + ":" + durationSeconds.slice(-2);
                }
            } else if(staff.salaryType.value !== "work_basis") {
                if(dayStatusObj.value === "absent") {
                    hours = "00:00";
                } else if(dayStatusObj.value === "half_day") {
                    hours = helperService.getHalfDayHours(staff.daily_shift_duration);
                } else {
                    hours = staff.daily_shift_duration;
                }
            }
            let latestPunchInTime = await attendanceService.fetchLatestPunchInTimeFor([staff.id]);
            let dayStatus = await taxonomyService.findTaxonomyById(attendanceRecord.day_status_txid);
            let data = {
                refId: staff.reference_id,
                phone: staff.phone,
                hours: hours ? hours : "",
                overtime: attendanceRecord.overtime ? attendanceRecord.overtime : "",
                overtimePay: attendanceRecord.overtime_pay ? attendanceRecord.overtime_pay : "",
                lateFineHours: attendanceRecord.late_fine_hours ? attendanceRecord.late_fine_hours : "",
                lateFineAmount: attendanceRecord.late_fine_amount ? attendanceRecord.late_fine_amount : "",
                status: dayStatus ? dayStatus.value : "",
                note: (attendanceRecord.meta && attendanceRecord.meta.note) ? attendanceRecord.meta.note : "",
                punchIn: attendanceRecord.punch_in_time ? attendanceRecord.punch_in_time : "",
                punchOut: attendanceRecord.punch_out_time ? attendanceRecord.punch_out_time : "",
                defaultPunchIn: (latestPunchInTime.length > 0) ? latestPunchInTime[0].punch_in_time : null
            }
            
            return res.status(200).send({ code: "success", message: "success", data: data });
        } catch(err) {
            await logger.error("Exception in save day status api: ", err);
            return res.status(200).send({ code: "error", message: "error" });
        }
    },

    saveOvertime: async (req,res) => {
        try {
            /** Validate Request */
            let requestValid = helperService.validateRequiredRequestParams(req.body, 
                    [ "date", "overtime", "overtimePay" ]);
            if(!requestValid) {
                await logger.info("Save overtime - missing params");
                return res.status(200).send({ code: "error", message: "missing_params" });
            }

            let { staffRefId } = req.params;

            /** Check if the staff exists */
            let staff = await staffService.fetchStaff(staffRefId, true);
            if(staff === null) {
                await logger.info("Save overtime - staff not found: " + staffRefId);
                return res.status(200).send({ code: "error", message: "staff_not_found" });
            }

            let { date, overtime, overtimePay, clearOvertime } = req.body;

            let params = {
                overtime: clearOvertime ? null : overtime,
                overtimePay: clearOvertime ? null : overtimePay,
                updatedBy: req.user,
                source: "user-action"
            }

            /** Populate the data object */
            let attendanceRecord = await attendanceService.createOrUpdateAttendance(staff.id, date, params);

            /** Put a job in update salary queue */
            awsService.addUpdateSalaryJob({ staffId: staffId, date: date });

            let dayStatusObj = await taxonomyService.findTaxonomyById(attendanceRecord.day_status_txid);
            let hours = "";
            if(staff.salaryType.value === "hourly") {
                if(attendanceRecord.punch_in_time && attendanceRecord.punch_out_time) {
                    let durationHours = "00" + moment(moment().format("YYYY-MM-DD ") + attendanceRecord.punch_out_time)
                                        .diff(moment().format("YYYY-MM-DD ") + attendanceRecord.punch_in_time, 'hour');
                    let durationMinutes = "00" + (moment(moment().format("YYYY-MM-DD ") + attendanceRecord.punch_out_time)
                                        .diff(moment().format("YYYY-MM-DD ") + attendanceRecord.punch_in_time, 'minute')) % 60;
                    let durationSeconds = "00" + (moment(moment().format("YYYY-MM-DD ") + attendanceRecord.punch_out_time)
                                        .diff(moment().format("YYYY-MM-DD ") + attendanceRecord.punch_in_time, 'second')) % 60;
                    hours =  durationHours.slice(-2) + ":" + durationMinutes.slice(-2) + ":" + durationSeconds.slice(-2);
                }
            } else if(staff.salaryType.value !== "work_basis") {
                if(dayStatusObj.value === "absent") {
                    hours = "00:00";
                } else if(dayStatusObj.value === "half_day") {
                    hours = helperService.getHalfDayHours(staff.daily_shift_duration);
                } else {
                    hours = staff.daily_shift_duration;
                }
            }
            let latestPunchInTime = await attendanceService.fetchLatestPunchInTimeFor([staff.id]);
            let dayStatus = await taxonomyService.findTaxonomyById(attendanceRecord.day_status_txid);
            let data = {
                refId: staff.reference_id,
                name: staff.name,
                hours: hours ? hours : "",
                overtime: attendanceRecord.overtime ? attendanceRecord.overtime : "",
                overtimePay: attendanceRecord.overtime_pay ? attendanceRecord.overtime_pay : "",
                lateFineHours: attendanceRecord.late_fine_hours ? attendanceRecord.late_fine_hours : "",
                lateFineAmount: attendanceRecord.late_fine_amount ? attendanceRecord.late_fine_amount : "",
                status: dayStatus ? dayStatus.value : "",
                note: (attendanceRecord.meta && attendanceRecord.meta.note) ? attendanceRecord.meta.note : "",
                punchIn: attendanceRecord.punch_in_time ? attendanceRecord.punch_in_time : "",
                punchOut: attendanceRecord.punch_out_time ? attendanceRecord.punch_out_time : "",
                defaultPunchIn: (latestPunchInTime.length > 0) ? latestPunchInTime[0].punch_in_time : null
            }
            
            return res.status(200).send({ code: "success", message: "success", data: data });
        } catch(err) {
            await logger.error("Exception in save overtime api: ", err);
            return res.status(200).send({ code: "error", message: "error" });
        }
    },

    saveLateFine: async (req,res) => {
        try {
            /** Validate Request */
            let requestValid = helperService.validateRequiredRequestParams(req.body, 
                    [ "date" ]);
            if(!requestValid) {
                await logger.info("Save late fine - missing params");
                return res.status(200).send({ code: "error", message: "missing_params" });
            }

            let { staffRefId } = req.params;

            /** Check if the staff exists */
            let staff = await staffService.fetchStaff(staffRefId, true);
            if(staff === null) {
                await logger.info("Save overtime - staff not found: " + staffRefId);
                return res.status(200).send({ code: "error", message: "staff_not_found" });
            }

            let { date, lateFineHours, lateFineAmount, clearLateFine } = req.body;

            let params = {
                lateFineHours: clearLateFine ? null : lateFineHours,
                lateFineAmount: clearLateFine ? null : lateFineAmount,
                updatedBy: req.user,
                source: "user-action"
            }

            /** Populate the data object */
            let attendanceRecord = await attendanceService.createOrUpdateAttendance(staff.id, date, params);

            /** Put a job in update salary queue */
            awsService.addUpdateSalaryJob({ staffId: staffId, date: date });

            let dayStatusObj = await taxonomyService.findTaxonomyById(attendanceRecord.day_status_txid);
            let hours = "";
            if(staff.salaryType.value === "hourly") {
                if(attendanceRecord.punch_in_time && attendanceRecord.punch_out_time) {
                    let durationHours = "00" + moment(moment().format("YYYY-MM-DD ") + attendanceRecord.punch_out_time)
                                        .diff(moment().format("YYYY-MM-DD ") + attendanceRecord.punch_in_time, 'hour');
                    let durationMinutes = "00" + (moment(moment().format("YYYY-MM-DD ") + attendanceRecord.punch_out_time)
                                        .diff(moment().format("YYYY-MM-DD ") + attendanceRecord.punch_in_time, 'minute')) % 60;
                    let durationSeconds = "00" + (moment(moment().format("YYYY-MM-DD ") + attendanceRecord.punch_out_time)
                                        .diff(moment().format("YYYY-MM-DD ") + attendanceRecord.punch_in_time, 'second')) % 60;
                    hours =  durationHours.slice(-2) + ":" + durationMinutes.slice(-2) + ":" + durationSeconds.slice(-2);
                }
            } else if(staff.salaryType.value !== "work_basis") {
                if(dayStatusObj.value === "absent") {
                    hours = "00:00";
                } else if(dayStatusObj.value === "half_day") {
                    hours = helperService.getHalfDayHours(staff.daily_shift_duration);
                } else {
                    hours = staff.daily_shift_duration;
                }
            }
            let latestPunchInTime = await attendanceService.fetchLatestPunchInTimeFor([staff.id]);
            let dayStatus = await taxonomyService.findTaxonomyById(attendanceRecord.day_status_txid);
            let data = {
                refId: staff.reference_id,
                name: staff.name,
                hours: hours ? hours : "",
                overtime: attendanceRecord.overtime ? attendanceRecord.overtime : "",
                overtimePay: attendanceRecord.overtime_pay ? attendanceRecord.overtime_pay : "",
                lateFineHours: attendanceRecord.late_fine_hours ? attendanceRecord.late_fine_hours : "",
                lateFineAmount: attendanceRecord.late_fine_amount ? attendanceRecord.late_fine_amount : "",
                status: dayStatus ? dayStatus.value : "",
                note: (attendanceRecord.meta && attendanceRecord.meta.note) ? attendanceRecord.meta.note : "",
                punchIn: attendanceRecord.punch_in_time ? attendanceRecord.punch_in_time : "",
                punchOut: attendanceRecord.punch_out_time ? attendanceRecord.punch_out_time : "",
                defaultPunchIn: (latestPunchInTime.length > 0) ? latestPunchInTime[0].punch_in_time : null
            }
            
            return res.status(200).send({ code: "success", message: "success", data: data });
        } catch(err) {
            await logger.error("Exception in save late fine api: ", err);
            return res.status(200).send({ code: "error", message: "error" });
        }
    },

    saveNote: async (req,res) => {
        try {
            /** Validate Request */
            let requestValid = helperService.validateRequiredRequestParams(req.body, 
                    [ "date", "note" ]);
            if(!requestValid) {
                await logger.info("Save note - missing params");
                return res.status(200).send({ code: "error", message: "missing_params" });
            }

            let { staffRefId } = req.params;

            /** Check if the staff exists */
            let staff = await staffService.fetchStaff(staffRefId, true);
            if(staff === null) {
                await logger.info("Save note - staff not found: " + staffRefId);
                return res.status(200).send({ code: "error", message: "staff_not_found" });
            }

            let { date, note, clearNote } = req.body;

            let params = {
                note: clearNote ? null : note,
                updatedBy: req.user,
                source: "user-action"
            }

            /** Populate the data object */
            let attendanceRecord = await attendanceService.createOrUpdateAttendance(staff.id, date, params);
            let dayStatusObj = await taxonomyService.findTaxonomyById(attendanceRecord.day_status_txid);
            let hours = "";
            if(staff.salaryType.value === "hourly") {
                if(attendanceRecord.punch_in_time && attendanceRecord.punch_out_time) {
                    let durationHours = "00" + moment(moment().format("YYYY-MM-DD ") + attendanceRecord.punch_out_time)
                                        .diff(moment().format("YYYY-MM-DD ") + attendanceRecord.punch_in_time, 'hour');
                    let durationMinutes = "00" + (moment(moment().format("YYYY-MM-DD ") + attendanceRecord.punch_out_time)
                                        .diff(moment().format("YYYY-MM-DD ") + attendanceRecord.punch_in_time, 'minute')) % 60;
                    let durationSeconds = "00" + (moment(moment().format("YYYY-MM-DD ") + attendanceRecord.punch_out_time)
                                        .diff(moment().format("YYYY-MM-DD ") + attendanceRecord.punch_in_time, 'second')) % 60;
                    hours =  durationHours.slice(-2) + ":" + durationMinutes.slice(-2) + ":" + durationSeconds.slice(-2);
                }
            } else if(staff.salaryType.value !== "work_basis") {
                if(dayStatusObj.value === "absent") {
                    hours = "00:00";
                } else if(dayStatusObj.value === "half_day") {
                    hours = helperService.getHalfDayHours(staff.daily_shift_duration);
                } else {
                    hours = staff.daily_shift_duration;
                }
            }
            let latestPunchInTime = await attendanceService.fetchLatestPunchInTimeFor([staff.id]);
            let dayStatus = await taxonomyService.findTaxonomyById(attendanceRecord.day_status_txid);
            let data = {
                refId: staff.reference_id,
                name: staff.name,
                hours: hours ? hours : "",
                overtime: attendanceRecord.overtime ? attendanceRecord.overtime : "",
                overtimePay: attendanceRecord.overtime_pay ? attendanceRecord.overtime_pay : "",
                lateFineHours: attendanceRecord.late_fine_hours ? attendanceRecord.late_fine_hours : "",
                lateFineAmount: attendanceRecord.late_fine_amount ? attendanceRecord.late_fine_amount : "",
                status: dayStatus ? dayStatus.value : "",
                note: (attendanceRecord.meta && attendanceRecord.meta.note) ? attendanceRecord.meta.note : "",
                punchIn: attendanceRecord.punch_in_time ? attendanceRecord.punch_in_time : "",
                punchOut: attendanceRecord.punch_out_time ? attendanceRecord.punch_out_time : "",
                defaultPunchIn: (latestPunchInTime.length > 0) ? latestPunchInTime[0].punch_in_time : null
            }
            
            return res.status(200).send({ code: "success", message: "success", data: data });
        } catch(err) {
            await logger.error("Exception in save note api: ", err);
            return res.status(200).send({ code: "error", message: "error" });
        }
    },

    fetchSingleStaffAttendance: async (req, res) => {
        try {
            /** Validate Request */
            let requestValid = helperService.validateRequiredRequestParams(req.query, 
                [ "from", "to" ]);
            if(!requestValid) {
                await logger.info("Fetch single staff attendance - missing params");
                return res.status(200).send({ code: "error", message: "missing_params" });
            }

            let { from, to } = req.query;
            let fromDate = moment(from);
            let toDate = moment(to);

            /** Check if the date range is valid */
            if(toDate.isBefore(fromDate)) {
                await logger.info("Fetch single staff attendance - from_date is after to_date. from: " + from + " to: " + to);
                return res.status(200).send({ code: "error", message: "invalid_date_range" });
            }

            let { staffRefId } = req.params;

            /** Fetch the staff */
            let staff = await staffService.fetchStaff(staffRefId, true);
            if(!staff) {
                await logger.info("Fetch single staff attendance - staff not found for reference id: " + staffRefId);
                return res.status(200).send({ code: "error", message: "staff_not_found" });
            }

            /** Fetch the attendance during the period */
            let attendance = await attendanceService.fetchStaffAttendanceForPeriod(staff.id, fromDate.format("YYYY-MM-DD"), toDate.format("YYYY-MM-DD"));

            /** Generate the response */
            let data = {
                name: staff.name,
                shifthours: staff.daily_shift_duration,
                currency: staff.business.currency
            };
            let statusSummary = {
                present: 0,
                absent: 0,
                halfDay: 0,
                paidLeave: 0
            };
            
            let latestPunchInTime = await attendanceService.fetchLatestPunchInTimeFor([staff.id]);
            let dayStatusMap = new Map();
            let attendanceList = [];
            for(let attendanceRecord of attendance) {
                let hours = "";
                let dayStatusObj = await taxonomyService.findTaxonomyById(attendanceRecord.day_status_txid);
                if(staff.salaryType.value === "hourly") {
                    if(attendanceRecord.punch_in_time && attendanceRecord.punch_out_time) {
                        let durationHours = "00" + moment(moment().format("YYYY-MM-DD ") + attendanceRecord.punch_out_time)
                                            .diff(moment().format("YYYY-MM-DD ") + attendanceRecord.punch_in_time, 'hour');
                        let durationMinutes = "00" + (moment(moment().format("YYYY-MM-DD ") + attendanceRecord.punch_out_time)
                                            .diff(moment().format("YYYY-MM-DD ") + attendanceRecord.punch_in_time, 'minute')) % 60;
                        let durationSeconds = "00" + (moment(moment().format("YYYY-MM-DD ") + attendanceRecord.punch_out_time)
                                            .diff(moment().format("YYYY-MM-DD ") + attendanceRecord.punch_in_time, 'second')) % 60;
                        hours =  durationHours.slice(-2) + ":" + durationMinutes.slice(-2) + ":" + durationSeconds.slice(-2);
                    }
                } else if(staff.salaryType.value !== "work_basis") {
                    if(dayStatusObj.value === "absent") {
                        hours = "00:00";
                    } else if(dayStatusObj.value === "half_day") {
                        hours = helperService.getHalfDayHours(staff.daily_shift_duration);
                    } else {
                        hours = staff.daily_shift_duration;
                    }
                }
                if(!dayStatusMap.has(attendanceRecord.day_status_txid)) {
                    let dayStatus = await taxonomyService.findTaxonomyById(attendanceRecord.day_status_txid);
                    dayStatusMap.set(attendanceRecord.day_status_txid, dayStatus);
                }
                
                attendanceList.push({
                    date: attendanceRecord.date,
                    name: staff.name,
                    hours: hours,
                    overtime: attendanceRecord.overtime ? attendanceRecord.overtime : "",
                    overtimePay: attendanceRecord.overtime_pay ? attendanceRecord.overtime_pay : "",
                    lateFineHours: attendanceRecord.late_fine_hours ? attendanceRecord.late_fine_hours : "",
                    lateFineAmount: attendanceRecord.late_fine_amount ? attendanceRecord.late_fine_amount : "",
                    status: dayStatusMap.get(attendanceRecord.day_status_txid) ? dayStatusMap.get(attendanceRecord.day_status_txid).value : "",
                    note: (attendanceRecord.meta && attendanceRecord.meta.note) ? attendanceRecord.meta.note : "",
                    punchIn: attendanceRecord.punch_in_time ? attendanceRecord.punch_in_time : "",
                    punchOut: attendanceRecord.punch_out_time ? attendanceRecord.punch_out_time : "",
                    defaultPunchIn: (latestPunchInTime.length > 0) ? latestPunchInTime[0].punch_in_time : null
                });

                /** Update aggregate data */
                if(dayStatusMap.get(attendanceRecord.day_status_txid)) {
                    switch(dayStatusMap.get(attendanceRecord.day_status_txid).value) {
                        case "present":
                            statusSummary.present += 1;
                            break;
                        case "absent":
                            statusSummary.absent += 1;
                            break;
                        case "half_day":
                            statusSummary.halfDay += 1;
                            break;
                        case "paid_leave":
                            statusSummary.paidLeave += 1;
                            break;
                        default:
                            break;
                    }
                }                
            }

            data.statusSummary = statusSummary;
            data.attendance = attendanceList;

            return res.status(200).send({ code: "success", message: "success", data: data });
        } catch(err) {
            await logger.error("Exception in fetch single staff attendance api: ", err);
            return res.status(200).send({ code: "error", message: "error" });
        }
    },

    calculatePayrollForBusiness: async (req, res) => {
        try {
            let { businessId, date } = req.query;
            await logger.info("Updating payroll for business id: " + businessId + " date: " + date);
            await attendanceService.updateStaffPayrollFor(businessId, date, true);
            return res.status(200).send({ code: "success", message: "success" });
        } catch(err) {
            await logger.error("Exception in calculate payroll for business api: ", err);
            return res.status(200).send({ code: "error", message: "error" });
        }
    }
}