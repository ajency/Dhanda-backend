const logger = require("simple-node-logger").createSimpleLogger({ timestampFormat:'YYYY-MM-DD HH:mm:ss.SSS' });
const awsConfig = (require("../config/thirdPartyConfig.json")).aws;
var aws = require('aws-sdk');

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
}