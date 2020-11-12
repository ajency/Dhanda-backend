const logger = require("simple-node-logger").createSimpleLogger({ timestampFormat:'YYYY-MM-DD HH:mm:ss.SSS' });
const awsConfig = (require("../config/thirdPartyConfig.json")).aws;
const aws = require('aws-sdk');
const { Consumer } = require('sqs-consumer');
const staffService = new (require("./v1/StaffService"));
const attendanceService = new (require("./v1/AttendanceService"));
const businessService = new (require("./v1/BusinessService"));
const moment = require("moment");

aws.config.update({
    region: awsConfig.credentials.region,
    accessKeyId: awsConfig.credentials.accessKeyId,
    secretAccessKey: awsConfig.credentials.secretAccessKey
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
        let sqs = new aws.SQS({ region: awsConfig.credentials.region, accessKeyId: awsConfig.credentials.accessKeyId, secretAccessKey: awsConfig.credentials.secret_access_key });
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
                handleMessage: async (message) => {
                    await logger.info("Update Salary Comsumer :: Processing message: " + JSON.stringify(message));

                    try {
                        /** Verify all required params are there */
                        let params = JSON.parse(message.Body);
                        if(!params.staffId || !params.date) {
                            // TODO: Save to failed queue
                            return;
                        }
                        
                        /** Fetch the staff information */
                        let staff = await staffService.fetchStaff(params.staffId);

                        /** Calculate the business month days */
                        let business = await businessService.fetchBusinessById(staff.business_id);
                        let dateObj = moment(params.date, "YYYY-MM-DD");  
                        let businessMonthDays = 30;
                        if(business.taxonomy.value === "calendar_month") {
                            businessMonthDays = dateObj.daysInMonth();
                        }

                        /** Update the salary */      
                        if(staff.salaryType && staff.salaryType.value === "weekly") {
                            let weeklyStartDate = moment(dateObj).startOf("week").add(1, "days").format("YYYY-MM-DD");
                            let weeklyEndDate = moment(dateObj).endOf("week").add(1, "days").format("YYYY-MM-DD");
                            await attendanceService.createOrUpdateStaffPayroll(staff, "weekly", weeklyStartDate, weeklyEndDate, businessMonthDays);
                        } else {
                            let monthlyStartDate = moment(dateObj).startOf("month").format("YYYY-MM-DD");
                            let monthlyEndDate = moment(dateObj).endOf("month").format("YYYY-MM-DD");
                            await attendanceService.createOrUpdateStaffPayroll(staff, "monthly", monthlyStartDate, monthlyEndDate, businessMonthDays);
                        }
                    } catch(err) {
                        await logger.info("Update Salary Consumer :: Error in handleMessage: ", err);
                        // TODO: Save to failed queue
                    }

                },
                sqs: new aws.SQS()
            });

            sqsConsumer.on('error', async (err) => {
                await logger.info("Update salary error: ", err)
            })
            sqsConsumer.on('processing_error', async (err) => {
                await logger.info("Update salary processing error: ", err)
                // TODO: Save to failed queue
            });
            return sqsConsumer;
        } catch(err) {
            await logger.info("Exception in update salary SQS consumer: ", err);
        }
    }
}