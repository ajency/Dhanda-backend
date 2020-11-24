const logger = require("simple-node-logger").createSimpleLogger({ timestampFormat:'YYYY-MM-DD HH:mm:ss.SSS' });
const awsConfig = (require("../config/thirdPartyConfig.json")).aws;
const aws = require('aws-sdk');
const { Consumer } = require('sqs-consumer');
const staffService = new (require("./v1/StaffService"));
const attendanceService = new (require("./v1/AttendanceService"));
const businessService = new (require("./v1/BusinessService"));
const moment = require("moment");
const models = require("../models");
const salaryPeriodService = new (require("./v1/SalaryPeriodService"));

aws.config.update({
    region: awsConfig.credentials.region,
    accessKeyId: awsConfig.credentials.access_key_id,
    secretAccessKey: awsConfig.credentials.secret_access_key
});

module.exports = class AwsService {
    async addUpdateSalaryJob(payload) {
        let { queueUrl } = awsConfig.queue.updateSalary;
        let duplicationId = "update_salary_" + (new Date().getTime());
        let type = (queueUrl.endsWith('.fifo') ? 'fifo' : 'standard');
        return await this.sendMessageToSqs(type, queueUrl, JSON.stringify(payload), duplicationId);
    }

    async sendMessageToSqs(type = 'standard', queueUrl, payload, duplicationId, groupId = null) { 
        console.log("sendMessageToSQS");
        let sqs = new aws.SQS({ region: awsConfig.credentials.region, accessKeyId: awsConfig.credentials.access_key_id, secretAccessKey: awsConfig.credentials.secret_access_key });
        let params = {};
        if(type == 'standard') {
            params = {
                // Remove DelaySeconds parameter and value for FIFO queues
                DelaySeconds: 10,
                MessageAttributes: {},
                MessageBody: payload,
                QueueUrl: queueUrl
            };
        } else {
            params = {
                MessageAttributes: {},
                MessageBody: payload,
                MessageDeduplicationId: duplicationId,  // Required for FIFO queues
                MessageGroupId: groupId,  // Required for FIFO queues
                QueueUrl: queueUrl
            };
        }

        await sqs.sendMessage(params, async function(err, data) {
            if (err) {
                await logger.info("Error", err);
            } else {
                await logger.info("Job added to queue. Message id: " + data.MessageId);
            }
        });
    }

    async runSqsConsumers() {
        await logger.info("Starting SQS consumers . . .")
        /** Update Salary */
        let updateSalaryConsumer = await this.updateSalaryConsumer();
        if(updateSalaryConsumer) {
            await logger.info("SQS Consumer :: Starting update salary SQS consumer.");
            updateSalaryConsumer.start();
        } else {
            await logger.info("SQS Consumer :: Update salary SQS consumer could not start.");
        }
    }

    async updateSalaryConsumer() {
        try {
            let sqsConsumer = Consumer.create({
                queueUrl: awsConfig.queue.updateSalary.queueUrl,
                attributeNames: [ "ApproximateReceiveCount" ],
                handleMessage: async (message) => {
                    await logger.info("Update Salary Comsumer :: Processing message: " + JSON.stringify(message));

                    let approximateReceiveCount = message.Attributes.ApproximateReceiveCount;

                    /** Verify all required params are there */
                    let params = JSON.parse(message.Body);
                    if(!params.staffId || !params.date) {
                        await this.saveFailedJob("update_salary", params);
                        if(approximateReceiveCount < parseInt(awsConfig.queueMaxTries)) {
                            throw new Error("Update salary failed, keeping job in queue.");
                        }
                        return;
                    }

                    try {
                        // /** Fetch the staff information */
                        // let staff = await staffService.fetchStaff(params.staffId);

                        // /** Calculate the business month days */
                        // let business = await businessService.fetchBusinessById(staff.business_id);
                        // let dateObj = moment(params.date, "YYYY-MM-DD");  
                        // let businessMonthDays = 30;
                        // if(business.taxonomy.value === "calendar_month") {
                        //     businessMonthDays = dateObj.daysInMonth();
                        // }

                        // let { startDate, endDate } = await staffService.fetchPeriodDates(staff, params.date);

                        // /** Update the salary */      
                        // if(staff.salaryType && staff.salaryType.value === "weekly") {
                        //     await attendanceService.createOrUpdateStaffPayroll(staff, "weekly", startDate, endDate, businessMonthDays);
                        // } else {
                        //     await attendanceService.createOrUpdateStaffPayroll(staff, "monthly", startDate, endDate, businessMonthDays);
                        // }
                        await attendanceService.updateSalaryPeriod(params.staffId, params.date)
                    } catch(err) {
                        await logger.info("Update Salary Consumer :: Error in handleMessage: ", err);
                        if(approximateReceiveCount < parseInt(awsConfig.queueMaxTries)) {
                            throw new Error("Update salary failed, keeping job in queue.");
                        }
                    }

                },
                sqs: new aws.SQS()
            });

            sqsConsumer.on('error', async (err) => {
                await logger.info("Update salary error: ", err)
            })
            sqsConsumer.on('processing_error', async (err) => {
                await logger.info("Update salary processing error: ", err)
            });
            return sqsConsumer;
        } catch(err) {
            await logger.info("Exception in update salary SQS consumer: ", err);
        }
    }

    async saveFailedJob(queue, payload) {
        await logger.info("Adding job to failed_jobs for: " + queue);
        await models.failed_jobs.create({ queue: queue, payload: payload });
    }
}