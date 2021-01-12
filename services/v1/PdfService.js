const puppeteer = require('puppeteer');
var moment = require('moment');
var fs = require('fs');
const models = require("../../models");

module.exports = class PdfService {

    /**check for s3 file */
    async fetchS3FileFromSlug(slug){

        return await models.s3_file.findOne({
            where: { slug:slug }
        });

    }

    /** generates BusinessAttendancePdf */
    async generateBusinessAttendancePdf(data,name){
       const content = this.generateDailyAttendanceHtml(data);
       try{
        let pdf= await this.generatePdf(content,name);
        return pdf;
       }catch(err){
        return null;
       }
       
    }


    /** generates singleStaffAttendancePdf */
    async generateSingleStaffAttendancePdf(data,name){
        const content = this.generateSingleStaffAttendanceHtml(data);
        try{
            let pdf = await this.generatePdf(content,name);
            return pdf;
        }catch(err){
            return null;
        }
        
    }

    async generatePaySlipPdf(data,name){
        
        const content = this.generatePaySLipHtml(data);
        try{
            const pdf = await this.generatePdf(content,name);
            //console.log('generatePaySlip',pdf);
            return pdf;
        }catch(err){
            console.log(err);
            return null;
        }
       
       
    }

    /** generate pdf from html file */
    async generatePdf(html,fileName){
        try{
            const browser = await puppeteer.launch({ headless: true });
            const page = await browser.newPage();
            await page.setContent(html);
            const buffer = await page.pdf({
                path:`${__dirname}/../../public/pdfs/${fileName}.pdf`,
                format: 'A4',
                printBackground: true,
                margin: {
                    left: '0px',
                    top: '0px',
                    right: '0px',
                    bottom: '0px'
                }
            })
                browser.close();
                // var filepath = `${__dirname}/../../pdfs/${fileName}.pdf`;
                // var binaryData = await fs.readFileSync(filepath);
               // var base64String = await Buffer.from(buffer).toString('base64');
                return `${__dirname}/../../public/pdfs/${fileName}.pdf`;
            }catch(e){
                console.log(e)
                return e;
            }
    }


    generateDailyAttendanceHtml =(data)=>{
   
    
        try{
        
     
         let head =`<div class="head-text-container">
         <div class="head-text-element align-item-start head-report">
             <label class="head-report">Attendance </label>
             <label class="head-report">Report</label>
         </div>
         <div class="head-text-element align-item-center">
             <label class="header-title">${moment(data.date).format('DD MMMM')}</label>
             <label class="header-value">${moment(data.date).format('YYYY')}</label>
         </div>
         <div class="head-text-element align-item-end">
             <label class="header-title">${data.businessName}</label>
             <label class="header-value">Export ${moment(data.date).format('DD MMM YYYY, h:mm a')}</label>
         </div>
         </div>`    
     
         let card =`<div class="card">
         <div class="card-element color-green">
             <label class="card-title">Present(P)</label>
             <label class="card-value">${data.staffStatusSummary.present}</label>
         </div >
         <div class="card-element color-red">
             <label class="card-title">Absent(A)</label>
             <label class="card-value">${data.staffStatusSummary.absent}</label>
         </div>
         <div class="card-element color-orange">
             <label class="card-title">Half Day(H)</label>
             <label class="card-value">${data.staffStatusSummary.halfDay}</label>
         </div>
         <div class="card-element color-blue">
             <label class="card-title">Paid Leave(PL)</label>
             <label class="card-value">${data.staffStatusSummary.paidHoliday}</label>
         </div>
         <div class="card-element border-left color-black ">
             <label class="card-title">Total</label>
             <label class="card-title">Overtime</label>
             <div class="time-container">
                 <label class="card-value card-time">24</label>
                 <label class="time-hrs">Hrs</label>
             </div>
             
         </div>
         </div>`
         
          let monthlyStaff = ``
     //     console.log(jsonObject.data.monthlyStaff)
         
         if(data.monthlyStaff){
     
                 var imagelink= ''
                
                 let tableHead =`
                 <div class="table-title">
                     <label class="table-title-text">Monthly Staff</label>
                 </div>
                 <div class="table-head">
                     <div class="table-head-element align-item-start flex-5">
                         <Label class="table-head-text">ID</Label>
                     </div>
                 <div class="table-head-element align-item-start flex-30">
                     <Label class="table-head-text">Staff Name</Label>
                 </div>
                 <div class="table-head-element align-item-center flex-10">
                     <Label class="table-head-text ">ST</Label>
                 </div>
                 <div class="table-head-element align-item-center flex-10">
                     <Label class="table-head-text ">OT</Label>
                 </div>
                 <div class="table-head-element align-item-end flex-10">
                     <Label class="table-head-text">LF</Label>
                 </div>
                 <div class="table-head-element align-item-start flex-35">
                     <Label class="table-head-text">Notes</Label>
                 </div>
                 </div>`
                 let tableBody=``
                 var i=0;
                    data.monthlyStaff.forEach(function(value){
                     i++;
                     
                     var img= '';
                     switch(value.status){
                         case 'present':
                             img =`<svg width="19" height="19" viewBox="0 0 19 19" fill="none" xmlns="http://www.w3.org/2000/svg">
                             <circle cx="9.5" cy="9.5" r="8.5" stroke="#0F9D58" stroke-width="2"/>
                             <path d="M12.6364 8.12C12.6364 8.47333 12.553 8.80667 12.3864 9.12C12.2197 9.43333 11.953 9.69 11.5864 9.89C11.2197 10.0833 10.7497 10.18 10.1764 10.18H8.91637V13H7.77637V6.05H10.1764C10.7097 6.05 11.1597 6.14333 11.5264 6.33C11.8997 6.51 12.1764 6.75667 12.3564 7.07C12.543 7.38333 12.6364 7.73333 12.6364 8.12ZM10.1764 9.25C10.6097 9.25 10.933 9.15333 11.1464 8.96C11.3597 8.76 11.4664 8.48 11.4664 8.12C11.4664 7.36 11.0364 6.98 10.1764 6.98H8.91637V9.25H10.1764Z" fill="#0F9D58"/>
                             </svg>`
                             break;
                         case 'absent':
                             img = `<svg width="19" height="19" viewBox="0 0 19 19" fill="none" xmlns="http://www.w3.org/2000/svg">
                             <circle cx="9.5" cy="9.5" r="8.5" stroke="#E90000" stroke-width="2"/>
                             <path d="M10.9537 11.58H8.04367L7.54367 13H6.35367L8.84367 6.04H10.1637L12.6537 13H11.4537L10.9537 11.58ZM10.6337 10.65L9.50367 7.42L8.36367 10.65H10.6337Z" fill="#E90000"/>
                             </svg>`    
                             break;
     
                         case 'halfday':
                             img = `<svg width="19" height="19" viewBox="0 0 19 19" fill="none" xmlns="http://www.w3.org/2000/svg">
                             <circle cx="9.5" cy="9.5" r="8.5" stroke="#E97E00" stroke-width="2"/>
                             <path d="M11.7746 6.05V13H10.6346V9.96H7.36461V13H6.22461V6.05H7.36461V9.03H10.6346V6.05H11.7746Z" fill="#E97E00"/>
                             </svg>
                             `    
                             break;
     
                         case 'paidleave':
                             img = `<svg width="19" height="19" viewBox="0 0 19 19" fill="none" xmlns="http://www.w3.org/2000/svg">
                             <circle cx="9.5" cy="9.5" r="8.5" stroke="#00B1E9" stroke-width="2"/>
                             <path d="M9.91469 8.12C9.91469 8.47333 9.83135 8.80667 9.66469 9.12C9.49802 9.43333 9.23135 9.69 8.86469 9.89C8.49802 10.0833 8.02802 10.18 7.45469 10.18H6.19469V13H5.05469V6.05H7.45469C7.98802 6.05 8.43802 6.14333 8.80469 6.33C9.17802 6.51 9.45469 6.75667 9.63469 7.07C9.82135 7.38333 9.91469 7.73333 9.91469 8.12ZM7.45469 9.25C7.88802 9.25 8.21135 9.15333 8.42469 8.96C8.63802 8.76 8.74469 8.48 8.74469 8.12C8.74469 7.36 8.31469 6.98 7.45469 6.98H6.19469V9.25H7.45469ZM12.142 12.08H14.492V13H11.002V6.05H12.142V12.08Z" fill="#00B1E9"/>
                             </svg>
                             `    
                             break;
                         default:
                             img='<div></div>'     
     
                     }
                     tableBody += ` <div class="table-element">
                         <div class="table-head-element align-item-start flex-5">
                             <Label class="table-text font-Poppins-SemiBold">${i}</Label>
                         </div>
                         <div class="table-head-element align-item-start flex-30">
                             <Label class="table-text font-Poppins-SemiBold">${value.name}</Label>
                         </div>
                         <div class="table-head-element align-item-center flex-10">
                             ${img}
                         </div>
                         <div class="table-head-element align-item-center flex-10">
                             <Label class="table-text font-Poppins-SemiBold">${value.overtime? value.overtime:'-'}</Label>
                         </div>
                         <div class="table-head-element align-item-end flex-10">
                             <Label class="table-text font-Poppins-SemiBold">${value.lateFineHours ? value.lateFineHours:'-'}</Label>
                         </div>
                         <div class="table-head-element align-item-start flex-35">
                             <Label class="table-notes ">${value.note}</Label>
                         </div>
                 
                     </div>`
                 })
              monthlyStaff = `${tableHead} ${tableBody}`;
        }   
              
         
          let hourlyStaff = ``
        
         if(data.hourlyStaff !== ''){
               
                 let tableHead =`
                 <div class="table-title">
                     <label class="table-title-text">Hourly Staff</label>
                 </div>
                 <div class="table-head">
                     <div class="table-head-element align-item-start flex-5">
                         <Label class="table-head-text">ID</Label>
                     </div>
                 <div class="table-head-element align-item-start flex-30">
                     <Label class="table-head-text">Staff Name</Label>
                 </div>
                 <div class="table-head-element align-item-center flex-10">
                     <Label class="table-head-text ">ST</Label>
                 </div>
                 <div class="table-head-element align-item-center flex-10">
                     <Label class="table-head-text ">OT</Label>
                 </div>
                 <div class="table-head-element align-item-end flex-10">
                     <Label class="table-head-text">LF</Label>
                 </div>
                 <div class="table-head-element align-item-start flex-35">
                     <Label class="table-head-text">Notes</Label>
                 </div>
                 </div>`
                 let tableBody=``
                 var i=0;
                    data.hourlyStaff.forEach(function(value){
                     i++;
                     var img= '';
                     switch(value.status){
                         case 'present':
                             img =`<svg width="19" height="19" viewBox="0 0 19 19" fill="none" xmlns="http://www.w3.org/2000/svg">
                             <circle cx="9.5" cy="9.5" r="8.5" stroke="#0F9D58" stroke-width="2"/>
                             <path d="M12.6364 8.12C12.6364 8.47333 12.553 8.80667 12.3864 9.12C12.2197 9.43333 11.953 9.69 11.5864 9.89C11.2197 10.0833 10.7497 10.18 10.1764 10.18H8.91637V13H7.77637V6.05H10.1764C10.7097 6.05 11.1597 6.14333 11.5264 6.33C11.8997 6.51 12.1764 6.75667 12.3564 7.07C12.543 7.38333 12.6364 7.73333 12.6364 8.12ZM10.1764 9.25C10.6097 9.25 10.933 9.15333 11.1464 8.96C11.3597 8.76 11.4664 8.48 11.4664 8.12C11.4664 7.36 11.0364 6.98 10.1764 6.98H8.91637V9.25H10.1764Z" fill="#0F9D58"/>
                             </svg>`
                             break;
                         case 'absent':
                             img = `<svg width="19" height="19" viewBox="0 0 19 19" fill="none" xmlns="http://www.w3.org/2000/svg">
                             <circle cx="9.5" cy="9.5" r="8.5" stroke="#E90000" stroke-width="2"/>
                             <path d="M10.9537 11.58H8.04367L7.54367 13H6.35367L8.84367 6.04H10.1637L12.6537 13H11.4537L10.9537 11.58ZM10.6337 10.65L9.50367 7.42L8.36367 10.65H10.6337Z" fill="#E90000"/>
                             </svg>`    
                             break;
     
                         case 'half_day':
                             img = `<svg width="19" height="19" viewBox="0 0 19 19" fill="none" xmlns="http://www.w3.org/2000/svg">
                             <circle cx="9.5" cy="9.5" r="8.5" stroke="#E97E00" stroke-width="2"/>
                             <path d="M11.7746 6.05V13H10.6346V9.96H7.36461V13H6.22461V6.05H7.36461V9.03H10.6346V6.05H11.7746Z" fill="#E97E00"/>
                             </svg>
                             `    
                             break;
     
                         case 'paid_leave':
                             img = `<svg width="19" height="19" viewBox="0 0 19 19" fill="none" xmlns="http://www.w3.org/2000/svg">
                             <circle cx="9.5" cy="9.5" r="8.5" stroke="#00B1E9" stroke-width="2"/>
                             <path d="M9.91469 8.12C9.91469 8.47333 9.83135 8.80667 9.66469 9.12C9.49802 9.43333 9.23135 9.69 8.86469 9.89C8.49802 10.0833 8.02802 10.18 7.45469 10.18H6.19469V13H5.05469V6.05H7.45469C7.98802 6.05 8.43802 6.14333 8.80469 6.33C9.17802 6.51 9.45469 6.75667 9.63469 7.07C9.82135 7.38333 9.91469 7.73333 9.91469 8.12ZM7.45469 9.25C7.88802 9.25 8.21135 9.15333 8.42469 8.96C8.63802 8.76 8.74469 8.48 8.74469 8.12C8.74469 7.36 8.31469 6.98 7.45469 6.98H6.19469V9.25H7.45469ZM12.142 12.08H14.492V13H11.002V6.05H12.142V12.08Z" fill="#00B1E9"/>
                             </svg>
                             `    
                             break;
                         default:
                             img='<div></div>'     
     
                     }
                     tableBody += ` <div class="table-element">
                         <div class="table-head-element align-item-start flex-5">
                             <Label class="table-text font-Poppins-SemiBold">${i}</Label>
                         </div>
                         <div class="table-head-element align-item-start flex-30">
                             <Label class="table-text font-Poppins-SemiBold">${value.name}</Label>
                         </div>
                         <div class="table-head-element align-item-center flex-10">
                              ${img}
                         </div>
                         <div class="table-head-element align-item-center flex-10">
                             <Label class="table-text font-Poppins-SemiBold">${value.overtime? value.overtime:'-'}</Label>
                         </div>
                         <div class="table-head-element align-item-end flex-10">
                             <Label class="table-text font-Poppins-SemiBold">${value.lateFineHours ? value.lateFineHours:'-'}</Label>
                         </div>
                         <div class="table-head-element align-item-start flex-35">
                             <Label class="table-notes ">${value.note}</Label>
                         </div>
                 
                     </div>`
                 })
                 hourlyStaff = `${tableHead} ${tableBody}`;
         }
     
          let html = `<!DOCTYPE html>
         <html>
             <head>
                 <title>index</title>
                 <!-- <link rel="StyleSheet" type="text/css" href="css/style.css"> -->
                 <link rel="preconnect" href="https://fonts.gstatic.com">
                 <link href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">    </head>
                 <style>
                     
                     
                 *{
                     margin: 0;
                     padding: 0;
                     box-sizing: border-box;                                                           
                 }
                 .color-red{
                     color:#E90000 ;
                 }
                 .color-green{
                     color: #0F9D58;
     
                 }
                 .color-orange{
                     color:#E97E00 ;
                 }
                 .color-blue{
                     color:#00B1E9 ;
                 }
                 .color-black{
                     color:#252525;
                 }
                 .border-left{
                     border-left: 1px solid #BEBEBE;
                 }
                 .align-item-center{
                     align-items: center;
                 }
                 .align-item-start{
                     align-items: flex-start;
                 }
                 .align-item-end{
                     align-items: flex-end;
                 }
     
                 .flex-5{
                     flex:0.05
                 }
                 .flex-10{
                     flex: 0.1;
                 }
                 .flex-15{
                     flex: 0.15;
                 }
                 .flex-20{
                     flex: 0.2;
                 }
                 .flex-25{
                     flex: 0.25;
                 }
                 .flex-30{
                     flex: 0.3;
                 }
                 .flex-35{
                     flex: 0.35;
                 }
     
                 .font-Poppins-Regular{
                     font-family: Poppins;
                     font-size: 10px;
                     font-style: normal;
                     font-weight: 400;
                     line-height: 15px;
                     letter-spacing: 0em;
                     text-align: left;
                     
                 }
                 .font-Poppins-SemiBold{
                     font-family: Poppins;
                     font-size: 12px;
                     font-style: normal;
                     font-weight: 500;
                     line-height: 18px;
                     letter-spacing: 0em;
                     text-align: left;
     
                 }
     
                 .container{
                     max-width: 1000px;
                     position: relative;
                     
                 }
                 .head-container{
                     height: 108px;
                     width:100%;
                     background-color: #0F9D58;
                     align-items: center;
                 }
     
                 .head-text-container{
                     width: 100%;
                     height: 50%;
                     display: flex;
                     flex-direction: row;
                     justify-content: center;
                     padding-top: 16px;
                     padding-left: 10px;
                     padding-right: 10px;
                 }
                 .head-text-element{
                     display: flex;
                     flex:1;
                     flex-direction: column;
                     justify-content: center;
                 }
                 .head-report{
                     font-family: Poppins;
                     font-size: 16px;
                     font-style: normal;
                     font-weight: 600;
                     line-height: 17px;
                     letter-spacing: 0em;
                     text-align: left;
                     color: rgb(255,255,255,1);
     
     
                 }
                 .header-title{
                     color: white;
                     font-family: Poppins;
                     font-size: 11px;
                     font-style: normal;
                     font-weight: 700;
                     line-height: 17px;
                     letter-spacing: 0em;
                     text-align: right;
     
                 }
                 .header-value{
                     color: white;
                     font-family: Poppins;
                     font-size: 9px;
                     font-style: normal;
                     font-weight: 500;
                     line-height: 14px;
                     letter-spacing: 0em;
                     text-align: right;
     
                 }
     
                 .head-text-container h1 {
                     color: white;
                     font-size: 16px;
                     font-weight: 600;
                     font-family: Poppins-Black;
                 }
     
                 .card{
                     width:90%;
                     height: 78px;
                     border-radius: 10px;
                     display: flex;
                     flex-direction: row;
                     align-self: center;
                     background-color: #FFFFFF;
                     box-shadow: 0px 0px 2px rgba(0, 0, 0, 0.25);
                     border-radius: 4px;
                     position: absolute;
                     top:70px;
                     left:0;
                     right: 0;
                     margin-right: auto;
                     margin-left: auto;
                     padding: 12px 30px;
                 }
     
                 .card-element{
                     display: flex;
                     flex: 1;
                     flex-direction: column;
                     align-items: center;
                     justify-content: center;
                     
                 }
     
                 .card-title{
                     font-family: Poppins;
                     font-size: 11px;
                     font-style: normal;
                     font-weight: 400;
                     line-height: 17px;
                     letter-spacing: 0em;
                     text-align: center;
     
     
                 }
                 .card-value{
                     font-family: Poppins;
                     font-size: 30px;
                     font-style: normal;
                     font-weight: 600;
                     line-height: 35px;
                     letter-spacing: 0em;
                     text-align: left;
     
                 }
                 .card-time-container{
     
                 }
                 .card-time{
                     font-family: Poppins-Regular;
                     font-size: 18px;
                     font-weight: 400;
                     line-height: 21px;
                 }
                 .time-hrs{
                     font-family: Poppins;
                     font-size: 11px;
                     font-style: normal;
                     font-weight: 600;
                     line-height: 12px;
                     letter-spacing: 0em;
                     text-align: center;
     
                 }
     
                 .table-container{
                     background-color: #FFFFFF;
                     width: 100%;
                     padding-top: 50px;
                     padding-left: 10px;
                     padding-right: 10px;
     
                 }
     
                 .status-description{
                     display: flex;
                     flex-direction: row;
                     align-items: center;
                     justify-content: space-between;
                     padding-right: 130px;
                     padding-left: 130px;
                     margin-top: 15px;
                     margin-bottom: 15px;
                 }
                 .status-title{
                     font-family: Poppins-Regular;
                     font-size: 10px;
                     font-style: normal;
                     font-weight: 600;
                     line-height: 15px;
                     letter-spacing: 0em;
                     text-align: right;
                 }
                 .status-value{
                     font-family: Poppins-Regular;
                     font-size: 10px;
                     font-style: normal;
                     font-weight: 400;
                     line-height: 15px;
                     letter-spacing: 0em;
                     text-align: right;
                 }
     
                 .table-title{
                     width: 100%;
                     display: flex;
                     flex-direction: row;
                     align-items: flex-start;
                     background-color: rgba(15, 157, 88, 0.03);;
                     height:40px;
                     padding:10px 10px;
                     margin-top: 15px;
     
                 }
                 .table-title-text{
                     font-family: Poppins;
                     font-size: 14px;
                     font-style: normal;
                     font-weight: 500;
                     line-height: 21px;
                     letter-spacing: 0em;
                     text-align: center;
                     color: #000000;  
                 }
                 .table-head{
                     width: 100%;
                     height: 40px;
                     display: flex;
                     flex-direction: row;
                     border-bottom: 1px solid #EAEAEA;
                 }
                 .table-head-element{
                 
                     display: flex;
                     flex-direction: column;
                     justify-content: center;
                     padding: 10px;
                     
                 }
                 .table-head-text{
                     font-family: Poppins;
                     font-size: 12px;
                     font-style: normal;
                     font-weight: 500;
                     line-height: 15px;
                     letter-spacing: 0em;
                     text-align: left;
                     color: #848484;
                 }
                 .table-element{
                     width: 100%;
                     height: 40px;
                     display: flex;
                     flex-direction: row;    
                 }
                 .table-text{
                 
                     font-size: 12px;
                     font-style: normal;
                     font-weight: 500;
                     line-height: 18px;
                     letter-spacing: 0em;
                     text-align: left;
                     color: #000000;
                     padding: 15px 0;
                 
                     height: 40px;
                 }
                 .table-notes{
                     font-family: Poppins;
                     font-size: 10px;
                     font-style: normal;
                     font-weight: 400;
                     line-height: 15px;
                     letter-spacing: 0em;
                     text-align: left;    
                     color: #000000;
                     padding: 8px 0;
                     
                 }
     
                 .footer{
                     width: 100%;
                     height: 20px;
                     display: flex;
                     flex-direction: column;
                     align-items: center;
                     justify-content: center;
                     background-color: rgba(15, 157, 88, 0.03);
                     margin-top:35px;
                 }
                 .footer-text{
                     font-family: Poppins;
                     font-size: 8px;
                     font-style: normal;
                     font-weight: 400;
                     line-height: 12px;
                     letter-spacing: 0em;
                     text-align: center;
                     padding:4px;
                     align-self: center;
     
                 }
                 </style>
             </head>
             <body>
                <div class="container">
                     <div class="head-container">
                         ${head}
                         ${card}
                     </div>
         
                     <div class="table-container">
                         <div class="status-description">
                             <div>
                                 <label class="status-title">ST </label>
                                 <label class="status-value">- Status</label>
                             </div>
                             <div>
                                 <label class="status-title">OT </label>
                                 <label class="status-value">- Overtime (Hrs) </label>
                             </div>
                             <div>
                                 <label class="status-title">LF  </label>
                                 <label class="status-value">- Late Fee (Hrs | Amt)</label>
                             </div>
                         </div>
                         ${monthlyStaff}
                         ${hourlyStaff}
                         <div class="footer">
                             <label class="footer-text">Powered By Ogaji App</label>
                         </div>
                     </div>
                </div>
             </body>
         </html>`
     
         return html;
         
         }catch(e){
             console.log(e)
         }
     }

    generateSingleStaffAttendanceHtml = (data)=>{    
        let head =`
        <div class="head-container">
        <div class="head-text-container">
            <div class="head-text-element align-item-start head-report">
                <label class="head-report">Attendance </label>
                <label class="head-report">Report</label>
            </div>
            <div class="head-text-element align-item-center">
                <label class="head-name">${data.name}</label>
                <label class="head-salaryType">Salaried:  </label>
                <label class="head-dateRange">1 Oct 2020 - 31 Oct 2020 </label>
            </div>
            <div class="head-text-element align-item-end">
                <label class="head-businessName">Rajesh Sweet Mart</label>
                <label class="head-exportTime">Export ${moment(new Date()).format('DD MMM YYYY , h:mm:ss a')}</label>
            </div>
        </div>
        </div>`;
    
        let card =`
            <div class="card">
            <div class="card-title">
                <label class="card-title-text">October Attendance Summary</label>
            </div>
            <div class="card-dataContainer">
                <div class="card-data-element">
                    <label class="card-data-title">Present</label>
                    <label class="card-data-title">(P)</label>
                    <label class="card-data-value color-green">${data.statusSummary.present}</label>
                </div >
                <div class="card-data-element">
                    <label class="card-data-title">Absent</label>
                    <label class="card-data-title">(A)</label>
                    <label class="card-data-value color-orange">${data.statusSummary.absent}</label>
                </div >
                <div class="card-data-element">
                    <label class="card-data-title">Half Day</label>
                    <label class="card-data-title ">(H)</label>
                    <label class="card-data-value color-yellow">${data.statusSummary.halfDay}</label>
                </div >
                <div class="card-data-element">
                    <label class="card-data-title">Paid Leave</label>
                    <label class="card-data-title">(PL)</label>
                    <label class="card-data-value color-blue">${data.statusSummary.paidLeave}</label>
                </div >
                <div class="card-data-element">
                    <label class="card-data-title">Overtime</label>
                    <label class="card-data-title">(Hrs)</label>
                    <label class="card-data-value color-grey">${data.statusSummary.overtime}</label>
                </div >
                <div class="card-data-element">
                    <label class="card-data-title">Late Fine</label>
                    <label class="card-data-title">(Hrs)</label>
                    <label class="card-data-value color-grey">${data.statusSummary.lateFineHrs}</label>
                </div >
                <div class="card-data-element">
                    <label class="card-data-title">Late Fine</label>
                    <label class="card-data-title">(Amt)</label>
                    <label class="card-data-value color-grey">${data.statusSummary.lateFineAmount}</label>
                </div >
                
                </div>
            </div>`

        let tableElement =``
        if(data.attendance){
            data.attendance.forEach(function(value){
            var text =``;
            switch(value.status){
                case 'present':
                    text =`<label class="status color-green">Present</label>`;
                    break;
                case 'absent':
                    text =`<label class="status color-orange">Absent</label>`;
                    break; 
                case 'half_day':
                    text =`<label class="status color-yellow">Half Day</label>`;
                    break; 
                case 'paid_leave':
                    text =`<label class="status color-green">Paid Leave</label>`;
                    break;   
                default:
                    text=`<label class="status"></label>`       
            }

            tableElement +=` 
           
                <div class="day-container">
                    <label class="date">${moment(value.date).format('DD MMM')}</label>
                    ${text}
                    <div>
                        <label class="negative">${value.lateFineHours ? `(${value.lateFineHours})`:''}</label>
                        <label class="positive">${value.overtime ? `(${value.overtime})`: ``}</label>
                    </div>
            
                </div>
           `

        })
        
    }        
    
    let html =`
    <!DOCTYPE html>
    <html>
        <head>
            <title>index</title>
            <!-- <link rel="styleSheet" type="text/css" href="css/singleStaff.css"> -->
            <link rel="preconnect" href="https://fonts.gstatic.com">
            <link href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">    </head>
            <style>
                *{
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
    
                .align-item-center{
                    align-items: center;
                }
                .align-item-start{
                    align-items: flex-start;
                }
                .align-item-end{
                    align-items: flex-end;
                }
                .container{
                    max-width: 1000px;
                    position: relative;
                    
                }
                .head-container{
                    height: 103px;
                    width:100%;
                    background-color: #0F9D58;
                    align-items: center;
                }
    
                .head-text-container{
                    width: 100%;
                    height: 100%;
                    display: flex;
                    flex-direction: row;
                    justify-content: center;
                    align-items: center;
                    padding-left: 25px;
                    padding-right: 25px;
                }
                .head-text-element{
                    display: flex;
                    flex:1;
                    flex-direction: column;
                    justify-content: center;
                }
                .head-report{
                    color: white;
                    font-size: 16px;
                    font-weight: 600;
                    line-height: 17px;
                    font-family: 'Poppins', sans-serif;
                }
                .head-name{
                    color: white;
                    font-size: 16px;
                    font-weight: 600;
                    line-height: 17px;
                    font-family: 'Poppins', sans-serif;
                }
                .head-salaryType{
                    color: rgb(255,255,255,0.75);
                    font-size: 9px;
                    font-weight: 500;
                    line-height: 13px;
                    margin-top: 3px;
                    font-family: 'Poppins', sans-serif;
                }
                .head-dateRange{
                    color: #FFFFFF;
                    font-size: 13px;
                    font-weight: 500;
                    line-height: 19px;
                    margin-top: 4px;
                    font-family: 'Poppins', sans-serif;
                }
                .head-businessName{
                    color: #FFFFFF;
                    font-size: 11px;
                    font-weight: 700;
                    line-height: 16px;
                    font-family: 'Poppins', sans-serif;
                }
                .head-exportTime{
                    color: #FFFFFF;
                    font-size: 9px;
                    font-weight: 500;
                    line-height: 13px;
                    font-family: 'Poppins', sans-serif;
                    text-align: right;
                }
                .card{
                    width:90%;
                    height: 115px;
                    border-radius: 10px;
                    display: flex;
                    flex-direction: column;
                    align-self: center;
                    background-color: #FFFFFF;
                    box-shadow: 0px 0px 2px rgba(0, 0, 0, 0.12);
                    border-radius: 4px;
                    margin-top: 40px;
                    margin-right: auto;
                    margin-left: auto;
                overflow: hidden;
                }
                .card-title{
                    width: 100%;
                    height: 40px;
                    display: flex;
                    flex-direction: row;
                    align-items: center;
                    justify-content: center;
                    background-color: rgba(15, 157, 88, 0.03);;
                    height:40px;
                    padding-top:9px;
                    padding-bottom: 9px;
                }
                .card-title-text{
                    font-size: 15px;
                    font-style: normal;
                    font-weight: 500;
                    line-height: 22px;
                    letter-spacing: 0em;
                    text-align: center;
                    color: rgb(24,103,178,1);
                    font-family:Poppins;
                
                }
                .card-dataContainer{
                    width: 100%;
                    height: 75px;
                    display: flex;
                    flex-direction: row;
                }
                .card-data-element{
                    display: flex;
                    flex: 1;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                }
                .card-data-title{
                    font-family: Poppins;
                    font-size: 12px;
                    font-style: normal;
                    font-weight: 500;
                    line-height: 18px;
                    letter-spacing: 0em;
                    text-align: center;
                    color: 0,0,0,0.7;
    
                }
                .card-data-value{
                    font-family: Poppins;
                    font-size: 18px;
                    font-style: normal;
                    font-weight: 500;
                    line-height: 27px;
                    letter-spacing: 0em;
                    text-align: center;
                    
                }
                .color-yellow{
                    color:#FF9600 ;
                }
                .color-green{
                    color: #0F9D58;
    
                }
                .color-orange{
                    color:#FF5530 ;
                }
                .color-blue{
                    color: #1867B2;
                    
                }
                .color-black{
                    color:#252525;
                }
                .color-grey{
                    color: #909090;
                    ;
                }
    
                .details-title{
                    margin-top: 32px;
                    width: 100%;
                    height: 40px;
                    display: flex;
                    flex-direction: row;
                    align-items: center;
                    justify-content: center;
                    background-color: rgba(15, 157, 88, 0.03);;
                    height:40px;
                    padding-top:9px;
                    padding-bottom: 9px;
                }
                .details-title-text{
                    font-size: 14px;
                    font-style: normal;
                    font-weight: 500;
                    line-height: 21px;
                    letter-spacing: 0em;
                    text-align: center;
                    color:#000000;
                    font-family:Poppins;
                
                }
                .month-container{
                    width: 90%;
                    margin-left: auto;
                    margin-right: auto;
                    margin-top: 17px;
                    display: flex;
                    flex-wrap: wrap;
                
                }
                .week-container{
                    width: 100%;
                    border-bottom: 1px solid #999999;
                    height: 70px;
                    margin-top: 17px;
                    margin-bottom: 17px;
                    display: flex;
                    flex-direction: row;
                }
                .day-container{
                    /* //flex:0.16; */
                    flex:0 16%;
                    height: 70px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    border-bottom: 1px solid #999999;
                    margin-top: 17px;
                
                }
                .date{
                    font-family: Poppins;
                    font-size: 14px;
                    font-style: normal;
                    font-weight: 500;
                    line-height: 21px;
                    letter-spacing: 0em;
                    text-align: center;
                    color:rgb(0,0,0,0.7);
                }
                .status{
                    font-family: Poppins;
                    font-size: 12px;
                    font-style: normal;
                    font-weight: 500;
                    line-height: 18px;
                    letter-spacing: 0em;
                    text-align: left;
                }
                .negative{
                    font-family: Poppins;
                    font-size: 9px;
                    font-style: normal;
                    font-weight: 500;
                    line-height: 14px;
                    letter-spacing: 0em;
                    text-align: left;
                    color: #EEA081;
                    
                }
                .positive{
                    font-family: Poppins;
                    font-size: 9px;
                    font-style: normal;
                    font-weight: 500;
                    line-height: 14px;
                    letter-spacing: 0em;
                    text-align: left;
                    color: #77BA77;
                    
                }
                .footer{
                    width: 100%;
                    height: 20px;
                    margin-top: 100px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    background-color: rgba(15, 157, 88, 0.03);
                }
                .footer-text{
                    font-family: Poppins-Regular;
                    font-size: 8px;
                    font-style: normal;
                    font-weight: 400;
                    line-height: 12px;
                    letter-spacing: 0em;
                    text-align: center;
                    padding:4px;
                    align-self: center;
    
                }
            </style>
        <body>
           <div class="container">
                ${head}    
                ${card}
                <div class="details-title">
                    <label class="details-title-text">Details</label>
                </div>
                <div class="month-container">
                ${tableElement}
                </div>
                <div class="footer">
                    <label class="footer-text">Powered By Ogaji App</label>
                </div>
                </div>
           </div>
        </body>
    </html>`;
    return html;

    }

    generatePaySLipHtml = (data)=>{
        //console.log(data);

        let head =`   
        <div class="head-container">
            <div class="head-text-container">
                <div class="head-text-element align-item-start">
                    <label class="head-businessName">${data.businessName}</label>
                    <label class="head-exportTime">Export ${moment(new Date()).format('DD MMM YYYY , h:mm:ss a')}</label> 
                </div>
                <div class="head-salary-text ">
                    <label class="head-dateRange">Salary Slip For</label>
                    <label class="head-dateRange">${data.payrollPeriod} </label>
                </div>
            </div>
        </div>`;
        let currency;
        if(data.currency === 'INR'){
            currency="rs"
        }else{
            currency="Rp."
        }
        let employeDetails = `  
        <div class="employee-details-container">
            <div class="green-bar">

            </div>
            <div class="detail">
                <div class="detail-item">
                    <label class="label">Staff Name</label>
                    <label class="value">: ${data.staffName}</label>
                </div>
                <div class="detail-item">
                    <label class="label">staff type</label>
                    <label class="value">: ${data.staffType}</label>
                </div>
                <div class="detail-item">
                    <label class="label">payroll period</label>
                    <label class="value">: ${data.payrollPeriod}</label>
                </div>
                <div class="detail-item">
                    <label class="label">salary as on payroll</label>
                    <label class="value">: ${currency} ${data.salaryOnPayroll}/- </label>
                </div>
                <div class="detail-item">
                    <label class="label">Working Days</label>
                    <label class="value">: ${data.workingDays}</label>
                </div>
                <div class="detail-item">
                    <label class="label">LOP days</label>
                    <label class="value">: ${data.lop}</label>
                </div>
            </div>
        </div>`;

        let tableData = ``;

            data.earningDeductions.forEach(function(value){
                tableData += `   
                 <div class="table-body">
                    <div class="earning-value-container border-right ">
                        <label class="earning-value-title  ">${value.earningsTitle}</label>
                    </div>
                    <div class="amount-value-container border-right ">
                        <label class="amount-value-title">${currency} ${value.earningsAmount}</label>
                    </div>
                    <div class="earning-value-container border-right ">
                        <label class="earning-value-title">${value.deductionTitle}</label>
                    </div>
                    <div class="amount-value-container">
                        <label class="amount-value-title">${currency} ${value.deductionAmount}</label>
                    </div>
             </div>`


            })

        let tablepreFoot=` 
            <div class="table-head border-top border-bottom">
                <div class="earnings-container border-right ">
                    <label class="earnings-title">gross earnings</label>
                </div>
                <div class="amount-container border-right ">
                    <label class="table-text">${currency} ${data.grossEarnings}</label>
                </div>
                <div class="earnings-container border-right ">
                    <label class="earnings-title">gross deductions</label>
                </div>
                <div class="amount-container">
                    <label class="table-text">${currency} ${data.grossDeductions}</label>
                </div>
            </div>`  ;

        let tableFoot = `
            <div class="table-foot ">
                <div class="net-container border-right">
                    <label class="earnings-title">NET PAYABLE SALARY</label>
                </div>
                <div class="netamount-container border-right">
                    <label class="table-text">${currency} ${data.netPayableSalary}</label>
                </div>
                <div class="net-container border-right">
                    <label class="earnings-title"></label>
                </div>
                <div class="netamount-container">
                    <label class="table-text"></label>
                </div>
            </div>`;

        let html = `
        <!DOCTYPE html>
        <html>
            <head>
                <title>index</title>
                <!-- <link rel="styleSheet" type="text/css" href="css/salarySlip.css"> -->
                <link rel="preconnect" href="https://fonts.gstatic.com">
                <link href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet"> 
                <style>
                        *{
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                        }
        
                        .align-item-center{
                            align-items: center;
                        }
                        .align-item-start{
                            align-items: flex-start;
                        }
                        .align-item-end{
                            align-items: flex-end;
                        }
                        .container{
                            max-width: 1000px;
                            position: relative;
                            
                        }
                        .head-container{
                            height: 124px;
                            width:100%;
                            background-color: #0F9D58;
                            align-items: center;
                        }
        
                        .head-text-container{
                            width: 100%;
                            height: 100%;
                            display: flex;
                            flex-direction: column;
                            padding-left: 25px;
                            padding-right: 25px;
                            
                        }
                        .head-text-element{
                            display: flex;
                            flex:1;
                            flex-direction: column;
                            justify-content: center;
                            margin-top: 22px;
                        }
                        .head-salary-text{
                            display: flex;
                            flex:1;
                            flex-direction: column;
                            justify-content: center;
                            align-items: center;
                            margin-bottom: 19px;
                            margin-top: 5px;
                        }
        
                        .head-dateRange{
                            color: #FFFFFF;
                            font-size: 16px;
                            font-weight: 500;
                            line-height: 24px;
                            margin-top: 4px;
                            font-family: 'Poppins', sans-serif;
                        }
                        .head-businessName{
                            color: #FFFFFF;
                            font-size: 11px;
                            font-weight: 700;
                            line-height: 16px;
                            font-family: 'Poppins', sans-serif;
                        }
                        .head-exportTime{
                            color: #FFFFFF;
                            font-size: 9px;
                            font-weight: 500;
                            line-height: 13px;
                            font-family: 'Poppins', sans-serif;
                            text-align: right;
                        }
        
                        .body-container{
                            width: 90%;
                            margin-left: auto;
                            margin-right: auto;
                            
                        }
                        .title-container{
                            width: 100%;
                            height: 40px;
                            display: flex;
                            flex-direction: row;
                            height:40px;
                            padding-top:9px;
                            padding-bottom: 9px;
                            margin-top: 20px;
                        }
                        .title-text{
                            font-size: 18px;
                            font-style: normal;
                            font-weight: 500;
                            line-height: 27px;
                            letter-spacing: 0em;
                            text-align: center;
                            color: rgb(24,103,178,1);
                            font-family:Poppins;
                        
                        }
                        .employee-details-container{
                            width: 100%;
                            height: 176px;
                            margin-top: 8px;
                            display: flex;
                            flex-direction: row;
                        }
                        .green-bar{
                            height: 100%;
                            background-color: #0F9D58;
                            width:5px
                        }
                        .detail{
                            width: 100%;
                            background-color: rgba(15, 157, 88, 0.03);
                        }
                        .detail-item{
                            width: 100%;
                            height: 18px;
                            flex: 1;
                            margin-top: 9px;
                            display: flex;
                            flex-direction: row;
                        }
                        .label{
                            padding-left: 10px;
                            flex:0.3;
                            text-transform: uppercase;
                            font-family: Poppins;
                            font-size: 12px;
                            font-style: normal;
                            font-weight: 500;
                            line-height: 18px;
                            letter-spacing: 0em;
                            text-align: left;
                            color: #0F9D58;
        
                        }
                        .value{
                            flex: 0.7;
                            padding-left: 10px;
                            font-family: Poppins;
                            font-size: 12px;
                            font-style: normal;
                            font-weight: 500;
                            line-height: 18px;
                            letter-spacing: 0em;
                            text-align: left;
                            color: #000000;
                        }
                        .table-container{
                            width: 100%;
                        
                        }
                        .table-head{
                            width: 100%;
                            height: 43px;
                            background-color: rgba(15, 157, 88, 0.03);
                            display: flex;
                            flex-direction: row;
                        
                        }
                        .earnings-container{
                            flex: 0.4;
                            display: flex;
                            align-items: center;
                            justify-content: left;
                        
                        }
                        .earnings-title{
                            font-family: Poppins;
                            font-size: 12px;
                            font-style: normal;
                            font-weight: 500;
                            line-height: 18px;
                            letter-spacing: 0em;
                            text-align: left;
                            color: #0F9D58;
                            text-transform: uppercase;
                            padding:16px ;
                            text-align: left;
                            
                        }
                        .amount-container{
                        
                            flex: 0.2;
                            display: flex;
                            align-items: center;
                            justify-content: flex-end;
                        
                        }
                        .amount-title{
                            font-family: Poppins;
                            font-size: 12px;
                            font-style: normal;
                            font-weight: 500;
                            line-height: 18px;
                            letter-spacing: 0em;
                            text-align: left;
                            color: #0F9D58;
                            text-transform: uppercase;
                            padding:16px ;
                            text-align: right;
                        }
                        .table-text{
                            font-family: Poppins;
                            font-size: 12px;
                            font-style: normal;
                            font-weight: 500;
                            line-height: 18px;
                            letter-spacing: 0em;
                            text-align: center;
                            padding:16px ;
                            color: #000000;
                        }
                        .table-foot{
                            width: 100%;
                            height: 43px;
                            background-color: rgba(15, 157, 88, 0.03);
                            display: flex;
                            flex-direction: row;
                        }
                        .net-container{
                            flex: 0.4;
                            display: flex;
                            align-items: center;
                            justify-content: left;
                            
                        }
                        .netamount-container{
                            flex: 0.2;
                            display: flex;
                            align-items: center;
                            justify-content: flex-end;
                        
                        }
                        .table-body{
                            width: 100%;
                            height: 43px;
                            background-color: rgba(15, 157, 88, 0.03);
                            display: flex;
                            flex-direction: row; 
                        }
                        .earning-value-container{
                            flex: 0.4;
                            display: flex;
                            align-items: center;
                            justify-content: left;
                            
                        }
                        .earning-value-title{
                            font-family: Poppins;
                            font-size: 12px;
                            font-style: normal;
                            font-weight: 500;
                            line-height: 18px;
                            letter-spacing: 0em;
                            text-align: left;
                            padding:16px ;
                            color: #000000;
                        }
                        .amount-value-container{
                            flex: 0.2;
                            display: flex;
                            align-items: center;
                            justify-content: flex-end;
                        
                        }
                        .amount-value-title{
                            font-family: Poppins;
                            font-size: 12px;
                            font-style: normal;
                            font-weight: 500;
                            line-height: 18px;
                            letter-spacing: 0em;
                            text-align: center;
                            padding:16px ;
                            color: #000000;
                        }
                        .conditon-container{
                            width: 100%;
                            height: 20px;
                            margin-top: 12px;
                            flex-direction: column;
                            align-items: center;
                            justify-content: center;
                        }
                        .condition-text{
                            font-family: Poppins;
                            font-size: 12px;
                            font-style: normal;
                            font-weight: 400;
                            line-height: 18px;
                            letter-spacing: 0em;
                            text-align: left;
                            color: rgb(0,0,0,0.7);
        
        
                        }
                        .footer{
                            width: 100%;
                            height: 20px;
                            margin-top: 25px;
                            flex-direction: column;
                            align-items: center;
                            justify-content: center;
                        }
                        .footer-text{
                            font-family: Roboto;
                            font-size: 9px;
                            font-style: normal;
                            font-weight: 400;
                            line-height: 11px;
                            letter-spacing: 0em;
                            text-align: left;
                            color: rgb(0,0,0,0.7);
                        }
                        .border-bottom{
                            border-bottom: 1px solid #0F9D58;
                        }
                        .border-top{
                            border-top: 1px solid #0F9D58;
                        }
                        .border-left{
                            border-left: 1px solid #0F9D58;
                        }
                        .border-right{
                            border-right: 1px solid #0F9D58;
                        }
                </style>   
            </head>
            <body>
               <div class="container">
                 ${head}    
                    <div class="body-container">
                        <div class="title-container">
                            <label class="title-text">Employee Details</label>
                        </div>
                        ${employeDetails}
                        <div class="title-container">
                            <label class="title-text">Calculation</label>
                        </div>
                        <div class="table-container border-top border-bottom border-right border-left">
                            <div class="table-head border-bottom">
                                <div class="earnings-container border-right">
                                    <label class="earnings-title">earnings</label>
                                </div>
                                <div class="amount-container border-right ">
                                    <label class="amount-title">amounts</label>
                                </div>
                                <div class="earnings-container border-right">
                                    <label class="earnings-title">deductions</label>
                                </div>
                                <div class="amount-container">
                                    <label class="amount-title">amount</label>
                                </div>
                            </div>
                            ${tableData}
                           
                           ${tablepreFoot}
                            
                            ${tableFoot}
        
                        </div>
                        <div class="conditon-container">
                            <label class="condition-text">*Calculated Earned Salary is Inclusive of Present Day(s), Half Day(s), Paid Leave(s)</label>
                        </div>
                        <div class="footer">
                            <label class="footer-text">Powered By Ogaji App</label>
                        </div>
                    </div>
                   
                    </div>
               </div>
            </body>
        </html>`

        return html;
    }


}