module.exports = class NotificationService {
    /**
     * Sends an email sns.
     *
     * @param      {<type>}  subject    The subject
     * @param      {<type>}  message    The message
     * @param      {<type>}  fromemail  The fromemail 
     * @param      {<type>}  toemail    The toemail  - array of email addresses
     * @param      {<type>}  [cc=[]]    { parameter_description }
     * @param      {<type>}  [bcc=[]]   The bcc
     */
    async sendEmailSES(subject,message,fromemail,toemail,ccaddress=[],bccaddress=[],replytoaddress=[]) {
        return new Promise(async (resolve, reject) => {
            var AWS = require('aws-sdk');       
            
            console.log("SEND_USER_NOTIFICATION",SEND_USER_NOTIFICATION)
            if(!SEND_USER_NOTIFICATION){
                fromemail = awsconfig.from_email
                toemail = awsconfig.to_email
                ccaddress = awsconfig.cc_email
                bccaddress = awsconfig.bcc_email
            }
            console.log("fromemail",fromemail)
            console.log("toemail",toemail)
            console.log("ccaddress",ccaddress)
            // Create sendEmail params 
            let params = {
                Destination: { /* required */
                    CcAddresses: ccaddress,
                    ToAddresses: toemail
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
            var sendPromise = new AWS.SES({ region: awsconfig.region, accessKeyId: awsconfig.access_key_id, secretAccessKey: awsconfig.secret_access_key }).sendEmail(params).promise();

            // Handle promise's fulfilled/rejected states
            sendPromise.then(
              function(data) {
                console.log(data);
                return resolve(data);
              }).catch(
                function(err) {
                console.error(err, err.stack);
                return reject(err, err.stack);
              });
        });
    },
}