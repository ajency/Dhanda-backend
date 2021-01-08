const logger = require("simple-node-logger").createSimpleLogger({ timestampFormat:'YYYY-MM-DD HH:mm:ss.SSS' });
const moment = require("moment");
const helperService = new (require("../../services/HelperService"));
const businessService = new (require("../../services/v1/BusinessService"));
const userService = new (require("../../services/v1/UserService"));
const staffService = new (require("../../services/v1/StaffService"));
const attendanceService = new (require("../../services/v1/AttendanceService"));
const notificationService = new (require("../../services/v1/NotificationService"));
const ormService = new (require("../../services/OrmService"));
const salaryPeriodService = new (require("../../services/v1/SalaryPeriodService"));
const taxonomService = new (require("../../services/v1/TaxonomyService"));
const authService = new (require("../../services/AuthService"));
const otpService = new (require("../../services/v1/OtpService"));

module.exports = {
    saveBusiness: async (req, res) => {
        try {
            /** Validate Request */
            let requestValid = helperService.validateRequiredRequestParams(req.body, 
                    [ "businessName", "currency", "salaryMonthType", "shiftHours"/*, "timezone", "countryCode"*/ ]);
            if(!requestValid) {
                await logger.info("Save business api - missing params.");
                return res.status(200).send({ code: "error", message: "missing_params" });
            }

            let { refId, owner, businessName, currency, salaryMonthType, shiftHours, 
                    timezone, countryCode, country, phCountryCode, phone, lang } = req.body;

            /** Create a new business */
            let businessObj = {
                name: businessName,
                currency: currency,
                salaryMonthType: "calendar_month", // hardcoded to calendar month
                shiftHours: shiftHours,
                timezone: timezone,
                countryCode: countryCode,
                country: country,
                phCountryCode: phCountryCode,
                phone: phone
            }

            let reqUser = await userService.fetchUserFromToken(req.headers.authorization);

            if(!refId) {
                let token = "";

                /** If an unverified user is making this call */
                if(!req.headers.authorization) {
                    /** Create a new un-verified user */
                    reqUser = await userService.createUser(null, null, lang);

                    /** Generate access token */
                    token = await authService.generateTokenForUser(reqUser, true);
                } else {
                    /** Check if no user is found for the passed token */
                    if(!reqUser) {
                        await logger.info("Save business api - user for token not found. token: " + req.headers.authorization);
                        return res.status(200).send({ code: "error", message: "user_not_found" });
                    }
                }

                /** Create a new business */
                let business = await businessService.createBusinessForUser(reqUser.id, businessObj);
            
                /** Update the user's name if passed */
                if(owner) {
                    await userService.updateUser({ name: owner }, business.user_id);
                }
                
                let data = {
                    refId: business.reference_id,
                    countryCode: business.country_code,
                    currency: business.currency,
                    shiftHours: business.shift_hours,
                    token: token
                }
                return res.status(200).send({ code: "add_staff", message: "success", data: data });
            } else {
                /** Check if reqUser is present */
                if(!reqUser) {
                    await logger.info("Save business api (update) - user for token not found. token: " + req.headers.authorization);
                    return res.status(200).send({ code: "error", message: "user_not_found" });
                }
                
                /** Check if the user is an admin */
                let isAdmin = await businessService.isUserAdmin(reqUser.id, refId, true);
                if(!isAdmin) {
                    await logger.info("Save business api - not an admin. user: " + reqUser.id + " business: " + refId);
                    return res.status(200).send({ code: "error", message: "not_an_admin" });
                }

                /** Update the business */
                let updateCount = await businessService.updateBusiness(refId, businessObj);
                if(updateCount[0] === 0) {
                    await logger.info("Save business - business not found: " + refId);
                    return res.status(200).send({ code: "error", message: "business_not_found" });
                }
                /** Update the user's name if passed */
                if(owner) {
                    await userService.updateUser({ name: owner }, updateCount[1][0].user_id);
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
                await logger.info("Fetch business - business not found: " + refId);
                return res.status(200).send({ code: "error", message: "business_not_found" });
            }

            /** Check if the user is an admin */
            let isAdmin = await businessService.isUserAdmin(req.user, refId, true);
            if(!isAdmin) {
                await logger.info("Fetch business api - not an admin. user: " + req.user + " business: " + refId);
                return res.status(200).send({ code: "error", message: "not_an_admin" });
            }

            let adminList = await businessService.fetchAdminListForBusiness(business, true);

            let staffMembers = await staffService.fetchStaffForBusinessId(business.id);

            let data = {
                "refId": business.reference_id,
                "owner": business.user.name,
                "businessName": business.name,
                "currency": business.currency,
                "salaryMonthType": business.taxonomy.value,
                "shiftHours": business.shift_hours,
                "country": business.country,
                "staffTotal": (staffMembers.length > 0) ? staffMembers.length : "",
                "admin": adminList,
                "phCountryCode": business.phCountryCode,
                "phone": business.phone
            }

            return res.status(200).send({ code: "success", message: "success", data: data });
        } catch(err) {
            await logger.error("Exception in fetch business api: ", err);
            return res.status(200).send({ code: "error", message: "error" });
        }
    },

    inviteAdmin: async (req, res) => {
        try {
            /** Validate Request */
            let requestValid = helperService.validateRequiredRequestParams(req.body, 
               [ "name", "countryCode", "phone" ]);
            if(!requestValid) {
                await logger.info("Invite admin api - missing params.");
                return res.status(200).send({ code: "error", message: "missing_params" });
            }

            /** Fetch the business by the reference id */
            let { businessRefId } = req.params;
            let business = await businessService.fetchBusinessById(businessRefId, true);

            if(business === null) {
                await logger.info("Invite admin api - business not found: " + businessRefId);
                return res.status(200).send({ code: "error", message: "business_not_found" });
            }

            /** Check if the user is an admin */
            let isAdmin = await businessService.isUserAdmin(req.user, business.id);
            if(!isAdmin) {
                await logger.info("Invite admin api - not an admin. user: " + req.user + " business: " + business.id);
                return res.status(200).send({ code: "error", message: "not_an_admin" });
            }

            let { countryCode, phone, name } = req.body;

            /** Fetch the staff */
            let user = await userService.fetchUserAndBusinessAdminByPhone(countryCode, phone);

            if(user) {
                if(user.businesses.length > 0) {
                    await logger.info("Invite admin api - user already an owner of a business. user: " + countryCode + " " + phone);
                    return res.status(200).send({ code: "error", message: "user_already_owner" });
                }
                if(user.businessUserRoles.length > 0) {
                    await logger.info("Invite admin api - user already an admin of a business. user: " + countryCode + " " + phone);
                    return res.status(200).send({ code: "error", message: "user_already_admin" });
                }
            }

            /** Check to see if this user is already invited to any business */
            let userRoleInvites = await businessService.fetchRoleInvitesFor("business_admin", null, countryCode, phone);
            if(userRoleInvites.length > 0) {
                await logger.info("Invite admin api - user already invited to be an admin of a business. user: " + countryCode + " " + phone);
                return res.status(200).send({ code: "error", message: "user_already_invited" });
            }

            /** Create an entry in the invite table */
            await businessService.createRoleInviteForUser(business.id, "business_admin", countryCode, phone, name, req.user);

            /** Send an SMS (for now sending email) */
            notificationService.sendBusinessAdminInvite({ countryCode: countryCode, phone: phone });

            return res.status(200).send({ code: "success", message: "success" });
        } catch(err) {
            await logger.error("Exception in invite admin api: ", err);
            return res.status(200).send({ code: "error", message: "error" });
        }
    },

    adminInviteResponse: async (req, res) => {
        try {
            /** Validate Request */
            let requestValid = helperService.validateRequiredRequestParams(req.query,
               [ "response" ]);
            if(!requestValid) {
                await logger.info("Respond to invite api - missing params.");
                return res.status(200).send({ code: "error", message: "missing_params" });
            }

            /** Fetch the invite */
            let invite = await businessService.fetchBusinessRoleInviteById(req.params.inviteRefId, true);
            if(!invite) {
                await logger.info("Respond to invite api - invite not found.");
                return res.status(200).send({ code: "error", message: "invite_not_found" });
            }

            if(invite.accepted !== null) {
                await logger.info("Respond to invite api - already responded to invite.");
                return res.status(200).send({ code: "error", message: "already_responded" });
            }

            /** Extra layer of checking to see if this is the invited user */
            let user = await ormService.fetchModelById("user", req.user);
            if(invite.country_code !== user.country_code || invite.phone !== user.phone) {
                await logger.info("Respond to invite api - responding to a wrong invite.");
                return res.status(200).send({ code: "error", message: "wrong_invite" });
            }

            /** Update the invite details */
            let { response } = req.query;
            let accepted = (response === "accept") ? true : false;
            await ormService.updateModel("business_user_role_invite", invite.id, { accepted: accepted });
            if(accepted) {
                /** Add this user to the business admin */
                await businessService.createBusinessUserRole(invite.business_id, user.id, invite.role_id);

                /** Update the user name, if not present from the invite details */
                if(!user.name) {
                    await ormService.updateModel("user", user.id, { name: invite.name });
                }

                let data = { 
                    businessRefId: invite.business.reference_id,
                    businessName: invite.business.name,
                    currency: invite.business.currency,
                    countryCode: invite.business.country_code,
                    shiftHours: invite.business.shift_hours
                };
                return res.status(200).send({ code: "home", message: "success", data: data });
            } else {
                /** Get the post login code for the user */
                let postLoginObj = await userService.fetchPostLoginCodeForUserByToken(req.headers.authorization);
                return res.status(200).send({ code: postLoginObj.code, message: "success", data: postLoginObj.data });
            }
        } catch(err) {
            await logger.error("Exception in respond to invite api api: ", err);
            return res.status(200).send({ code: "error", message: "error" });
        }

    },

    resendInvite: async (req, res) => {
        try {
            /** Fetch the invite by the reference id */
            let invite = await businessService.fetchBusinessRoleInviteById(req.params.inviteRefId, true);

            if(!invite || !invite.accepted || invite.deleted) {
                await logger.info("Resend admin invite api - invite not found. ref_id: " + req.params.inviteRefId);
                return res.status(200).send({ code: "error", message: "invite_not_found" });
            }

            /** Check if the user is an admin */
            let isAdmin = await businessService.isUserAdmin(req.user, invite.business.id);
            if(!isAdmin) {
                await logger.info("Resend admin invite api - not an admin. user: " + req.user + " business: " + invite.business.id);
                return res.status(200).send({ code: "error", message: "not_an_admin" });
            }
            
            /** Send notification */
            notificationService.sendBusinessAdminInvite({ countryCode: invite.country_code, phone: invite.phone });
            return res.status(200).send({ code: "success", message: "success" });
        } catch(err) {
            await logger.error("Exception in resend admin invite api: ", err);
            return res.status(200).send({ code: "error", message: "error" });
        }
 
    },

    deleteInvite: async (req, res) => {
        try {
            /** Fetch the invite by the reference id */
            let invite = await businessService.fetchBusinessRoleInviteById(req.params.inviteRefId, true);

            if(!invite) {
                await logger.info("Delete admin invite api - invite not found. ref_id: " + req.params.inviteRefId);
                return res.status(200).send({ code: "error", message: "invite_not_found" });
            }

            /** Check if the user is an admin */
            let isAdmin = await businessService.isUserAdmin(req.user, invite.business.id);
            if(!isAdmin) {
                await logger.info("Delete admin invite api - not an admin. user: " + req.user + " business: " + invite.business.id);
                return res.status(200).send({ code: "error", message: "not_an_admin" });
            }

            /** Delete the invite */
            await ormService.updateModel("business_user_role_invite", invite.id, { deleted: true });

            return res.status(200).send({ code: "success", message: "success" });
        } catch(err) {
            await logger.error("Exception in delete admin invite api: ", err);
            return res.status(200).send({ code: "error", message: "error" });
        }

    },

    removeAdmin: async (req, res) => {
        try {
            /** Fetch the admin user */
            let adminUser = await userService.fetchUserById(req.params.adminRefId, true);

            if(!adminUser) {
                await logger.info("Remove admin api - admin user not found. ref_id: " + req.params.adminRefId);
                return res.status(200).send({ code: "error", message: "admin_not_found" });
            }

            /** Fetch business */
            let business = await businessService.fetchBusinessById(req.params.businessRefId, true);
            if(!business) {
                await logger.info("Remove admin api - business not found. ref_id: " + req.params.businessRefId);
                return res.status(200).send({ code: "error", message: "business_not_found" });
            }

            /** Check if the user is an admin */
            let isAdmin = await businessService.isUserAdmin(req.user, business.id);
            if(!isAdmin) {
                await logger.info("Remove admin api - not an admin. user: " + req.user + " business: " + business.id);
                return res.status(200).send({ code: "error", message: "not_an_admin" });
            }

            /** Check if the user is an admin of this business */
            let businessUserRoles = await businessService.fetchBusUserRoleByRoleForBusiness("business_admin", business.id, adminUser.id);
            if(businessUserRoles.length === 0) {
                await logger.info("Remove admin api - user is not an admin. ref_id: " + req.params.businessRefId);
                return res.status(200).send({ code: "error", message: "user_not_admin" });
            }

            /** Delete the business user role */
            await ormService.updateModel("business_user_role", businessUserRoles[0].id, { deleted: true });

            return res.status(200).send({ code: "success", message: "success" });
        } catch(err) {
            await logger.error("Exception in remove admin api: ", err);
            return res.status(200).send({ code: "error", message: "error" });
        }
 
    },

    fetchBusinessStaffDues: async (req, res) => {
        try {
            let { businessRefId } = req.params;

            let business = await businessService.fetchBusinessById(businessRefId, true);

            if(business === null) {
                await logger.info("Fetch business staff dues - business not found: " + businessRefId);
                return res.status(200).send({ code: "error", message: "business_not_found" });
            }

            /** Check if the user is an admin */
            let isAdmin = await businessService.isUserAdmin(req.user, businessRefId, true);
            if(!isAdmin) {
                await logger.info("Fetch business staff dues api - not an admin. user: " + req.user + " business: " + businessRefId);
                return res.status(200).send({ code: "error", message: "not_an_admin" });
            }

            // let adminList = await businessService.fetchAdminListForBusiness(business, true);

            /** Fetch and segregate the staff members */
            let staffMembers = await staffService.fetchStaffForBusinessId(business.id);
            let monthlyStaffIds = [];
            let hourlyStaffIds = [];
            let allStaffIds = staffMembers.map((s) => { 
                if(s.salaryType) {
                    if(s.salaryType.value === "hourly") {
                        hourlyStaffIds.push(s.id);
                    } else {
                        monthlyStaffIds.push(s.id);
                    }
                }
                return s.id
            });

            /** Fetch the latest salary period for each staff in one go */
            let staffSalaryPeriods = await salaryPeriodService.fetchLatestSalaryPeriodsForStaff(allStaffIds);
            let staffSalaryPeriodMap = new Map();
            for(let staffSalaryPeriod of staffSalaryPeriods) {
                staffSalaryPeriodMap.set(staffSalaryPeriod.staff_id, staffSalaryPeriod);
            }

            /** Fetch the latest attendance for each staff in one go */
            let staffAttendance = await attendanceService.fetchLatestAttendanceForStaff(allStaffIds);
            let staffAttendanceMap = new Map();
            for(let att of staffAttendance) {
                staffAttendanceMap.set(att.staff_id, att);
            }

            /** Fetch the day status */
            let dayStatusTx = await taxonomService.fetchTaxonomyForType("day_status");
            let dayStatusMap = new Map();
            for(let dst of dayStatusTx) {
                dayStatusMap.set(dst.id, dst.value);
            }

            /** Generate the response */
            let monthlyStaff = [];
            let hourlyStaff = [];
            let totalAmountDue = 0;
            for(let staff of staffMembers) {
                let att = staffAttendanceMap.has(staff.id) ? staffAttendanceMap.get(staff.id) : null;
                let staffDetailAmountDue = staffSalaryPeriodMap.has(staff.id) ? parseFloat(staffSalaryPeriodMap.get(staff.id).total_dues) : null;
                let staffDetail = {
                    refId: staff.reference_id,
                    name: staff.name,
                    amountDue: staffDetailAmountDue ? helperService.roundOff(staffDetailAmountDue, 2) : "",
                    date: att ? att.date : "",
                    dateStatus: (att && dayStatusMap.has(att.day_status_txid)) ? dayStatusMap.get(att.day_status_txid) : "",
                    hours: "",
                    staffType: staff.salaryType.value
                }
                totalAmountDue += staffDetail.amountDue === "" ? 0 : staffDetail.amountDue;


                if(hourlyStaffIds.includes(staff.id)) {
                    /** Calculate the total hours */
                    let hours = "00:00:00";
                    if(att.punch_in_time && att.punch_out_time) {
                        hours = helperService.getTimeDifference(att.punch_in_time, att.punch_out_time);
                    } else if(att.punch_in_time) {
                        let currentTime = moment().utcOffset(business.timezone).format("HH:mm");
                        hours = helperService.getTimeDifference(att.punch_in_time, currentTime);
                    }
                    staffDetail.hours = hours;
                    hourlyStaff.push(staffDetail);
                } else {
                    monthlyStaff.push(staffDetail);
                }
            }

            let data = {
                businessName: business.name,
                totalAmountDue: helperService.roundOff(totalAmountDue, 2),
                currency: business.currency,
                monthlyStaff: monthlyStaff,
                hourlyStaff: hourlyStaff
            }

            return res.status(200).send({ code: "success", message: "success", data: data });
        } catch(err) {
            await logger.error("Exception in fetch business dues api: ", err);
            return res.status(200).send({ code: "error", message: "error" });
        }
    },

    verifyOwner: async (req, res) => {
        try {
            let { businessRefId } = req.params;

            let business = await businessService.fetchBusinessById(businessRefId, true);

            if(business === null) {
                await logger.info("Verify business owner - business not found: " + businessRefId);
                return res.status(200).send({ code: "error", message: "business_not_found" });
            }

            /** Check if any of the phone details are missing */
            if(!business.ph_country_code || !business.phone) {
                await logger.info("Verify business owner - phone details missing. business: " + businessRefId
                    + " country code: " + business.ph_country_code + " phone: " + business.phone);
                return res.status(200).send({ code: "error", message: "phone_not_valid" });
            }

            /** Check if the user already exists */
            let user = await userService.fetchUserByPhone(business.ph_country_code, business.phone);
            if(user) {
                await logger.info("Verify business owner - user already exists. business: " + businessRefId
                    + " country code: " + business.ph_country_code + " phone: " + business.phone);
                return res.status(200).send({ code: "error", message: "user_exists" });
            }

            /** Generate and send otp */
            let resp = await otpService.generateAndSendOtpWrapper(business.ph_country_code, business.phone, "verify_user")

            return res.status(200).send(resp);
        } catch(err) {
            await logger.error("Exception in verify business owner api: ", err);
            return res.status(200).send({ code: "error", message: "error" });
        }
    },

    updatePhone: async (req, res) => {
        try {
            let { businessRefId } = req.params;

            let business = await businessService.fetchBusinessById(businessRefId, true);

            if(business === null) {
                await logger.info("Update phone - business not found: " + businessRefId);
                return res.status(200).send({ code: "error", message: "business_not_found" });
            }

            let { countryCode, phone } = req.body;

            /** Check if the user already exists */
            let user = await userService.fetchUserByPhone(countryCode, phone);
            if(user) {
                await logger.info("Update phone - user already exists. business: " + businessRefId
                    + " country code: " + business.ph_country_code + " phone: " + business.phone);
                return res.status(200).send({ code: "error", message: "user_exists" });
            }

            /** Update phone in the business */
            await ormService.updateModel("business", business.id, { 
                ph_country_code: countryCode,
                phone: phone
            });

            /** Generate and send otp */
            let resp = await otpService.generateAndSendOtpWrapper(countryCode, phone, "verify_user")

            return res.status(200).send(resp);
        } catch(err) {
            await logger.error("Exception in update phone api: ", err);
            return res.status(200).send({ code: "error", message: "error" });
        }
    }
}