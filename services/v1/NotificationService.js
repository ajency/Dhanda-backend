const logger = require("simple-node-logger").createSimpleLogger({ timestampFormat:'YYYY-MM-DD HH:mm:ss.SSS' });
const AWS = require('aws-sdk');
const defaults = require("../defaults");

module.exports = class NotificationService {
    /**
     * Sends an email sns.
     *
     * @param      {<type>}  subject    The subject
     * @param      {<type>}  message    The message
     * @param      {<type>}  fromemail  The fromemail 
     * @param      {<type>}  toemail    The toemail  - array of email addresses
     * @param      {<type>}  [cc=[]]    { parameter_description }
     */
    async sendEmailSES(subject,message,fromemail,toemail,ccaddress=[],replytoaddress=[]) {
        return new Promise(async (resolve, reject) => { 
            if(process.env.EMAIL_SANDBOX === "true") {
                await logger.info("Email sandbox mode active.");
                fromemail = defaults.getValue("email_default").from_email;
                toemail = defaults.getValue("email_default").to_email;
                ccaddress = defaults.getValue("email_default").cc_email;
            }
            await logger.info("fromemail", fromemail, " toemail ",toemail ," ccaddress ", ccaddress);
            // Create sendEmail params 
            let params = {
                Destination: { /* required */
                    CcAddresses: ccaddress,
                    ToAddresses: toemail,
                },
                Message: { /* required */
                    Body: { /* required */
                        Html: {
                            Charset: "UTF-8",
                            Data: message
                        },
                        Text: {
                            Charset: "UTF-8",
                            Data: "TEXT_FORMAT_BODY"
                        }
                    },
                    Subject: {
                        Charset: 'UTF-8',
                        Data: subject
                    }
                },
                Source: fromemail, /* required */
                ReplyToAddresses: replytoaddress,
            };

            // Create the promise and SES service object
            var sendPromise = new AWS.SES({ region: process.env.AWS_REGION, 
                accessKeyId: process.env.AWS_ACCESS_KEY_ID, 
                secretAccessKey: process.env.AWS_SECRET_SECRET_KEY }).sendEmail(params).promise();

            // Handle promise's fulfilled/rejected states
            sendPromise.then(
                async function(data) {
                    await logger.info(data);
                    return resolve(data);
            }).catch(
                async function(err) {
                    await logger.error(err, err.stack);
                    return reject(err, err.stack);
              });
        });
    }
}