const { exec } = require('child_process');
const config = require('../config/configLoader.js');

/**
 * 📧 sendEmailAlert
 * Zero-dependency mail utility that handles native Linux sendmail / mail commands.
 * Alerts user of smart display failures or self-healing events.
 */
function sendEmailAlert(subject, body) {
  const alertEmail = config.alertEmail;
  if (!alertEmail) return;

  console.log(`Self-Healing: Attempting to send email alert to ${alertEmail}...`);
  
  const cleanSubject = (subject || '').replace(/"/g, '\\"').replace(/\n/g, ' ');
  const cleanBody = (body || '').replace(/"/g, '\\"');
  
  const mailCmd = `echo "${cleanBody}" | mail -s "${cleanSubject}" "${alertEmail}"`;
  
  exec(mailCmd, (err) => {
    if (err) {
      console.warn('Mail command failed, trying sendmail fallback:', err.message);
      const sendmailCmd = `(echo "Subject: ${cleanSubject}"; echo ""; echo "${cleanBody}") | sendmail "${alertEmail}"`;
      exec(sendmailCmd, (smErr) => {
        if (smErr) {
          console.warn('All native Linux email utilities failed to send warning:', smErr.message);
        } else {
          console.log('Email alert successfully sent via sendmail!');
        }
      });
    } else {
      console.log('Email alert successfully sent via mail command!');
    }
  });
}

module.exports = { sendEmailAlert };
