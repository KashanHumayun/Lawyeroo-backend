// src/utils/emailSender.js

const sgMail = require('../config/emailConfig');

const sendEmail = async ({ to, subject, text, html }) => {
    const msg = {
        to, // Recipient email address
        from: 'kashanhumayun076@gmail.com', // Verified sender email address in SendGrid
        subject,
        text,
        html,
    };

    try {
        await sgMail.send(msg);
        console.log('Email sent successfully');
    } catch (error) {
        console.error('Error sending email:', error);
        throw new Error('Email sending failed');
    }
}

module.exports = sendEmail;
