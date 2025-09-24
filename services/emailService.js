const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: process.env.EMAIL_PORT == 465, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  async sendEmail(to, subject, html, text) {
    try {
      const mailOptions = {
        from: `"SkillSwap Hub" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html,
        text
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', result.messageId);
      return result;
    } catch (error) {
      console.error('Email sending failed:', error);
      throw error;
    }
  }

  async sendWelcomeEmail(user) {
    const subject = 'Welcome to SkillSwap Hub!';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #4f46e5;">Welcome to SkillSwap Hub, ${user.firstName}!</h1>
        <p>We're excited to have you join our peer-to-peer skill exchange community.</p>
        
        <h2>Getting Started:</h2>
        <ul>
          <li>Complete your profile with your skills and what you want to learn</li>
          <li>Browse and discover other users with complementary skills</li>
          <li>Send match requests to start exchanging knowledge</li>
          <li>Use your tokens to reward great teachers</li>
        </ul>
        
        <p>You've been credited with <strong>100 tokens</strong> to get started!</p>
        
        <div style="margin: 30px 0; padding: 20px; background-color: #f3f4f6; border-radius: 8px;">
          <h3>Tips for Success:</h3>
          <ul>
            <li>Be specific about your skills and learning goals</li>
            <li>Respond promptly to match requests</li>
            <li>Be respectful and professional in all interactions</li>
            <li>Leave honest ratings after each exchange</li>
          </ul>
        </div>
        
        <p>Happy learning and teaching!</p>
        <p>The SkillSwap Hub Team</p>
      </div>
    `;
    
    const text = `Welcome to SkillSwap Hub, ${user.firstName}! We're excited to have you join our peer-to-peer skill exchange community. You've been credited with 100 tokens to get started!`;
    
    return this.sendEmail(user.email, subject, html, text);
  }

  async sendMatchNotification(user, match, requester) {
    const subject = 'New Skill Match Request';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #4f46e5;">New Match Request!</h1>
        <p>Hi ${user.firstName},</p>
        
        <p><strong>${requester.firstName} ${requester.lastName}</strong> wants to exchange skills with you!</p>
        
        <div style="margin: 20px 0; padding: 20px; background-color: #f3f4f6; border-radius: 8px;">
          <h3>Exchange Details:</h3>
          <p><strong>They're offering:</strong> ${match.skillOffered.name}</p>
          <p><strong>They want to learn:</strong> ${match.skillRequested.name}</p>
          ${match.message ? `<p><strong>Message:</strong> "${match.message}"</p>` : ''}
        </div>
        
        <p>
          <a href="${process.env.CLIENT_URL}/matches" 
             style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            View Match Request
          </a>
        </p>
        
        <p>Don't keep them waiting - respond today!</p>
        <p>The SkillSwap Hub Team</p>
      </div>
    `;
    
    const text = `New match request from ${requester.firstName} ${requester.lastName}! They're offering ${match.skillOffered.name} and want to learn ${match.skillRequested.name}.`;
    
    return this.sendEmail(user.email, subject, html, text);
  }

  async sendMatchAcceptedNotification(user, match, accepter) {
    const subject = 'Your Match Request Was Accepted!';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #10b981;">Match Accepted! 🎉</h1>
        <p>Hi ${user.firstName},</p>
        
        <p>Great news! <strong>${accepter.firstName} ${accepter.lastName}</strong> has accepted your skill exchange request.</p>
        
        <div style="margin: 20px 0; padding: 20px; background-color: #ecfdf5; border-radius: 8px;">
          <h3>Exchange Details:</h3>
          <p><strong>You're offering:</strong> ${match.skillOffered.name}</p>
          <p><strong>You want to learn:</strong> ${match.skillRequested.name}</p>
        </div>
        
        <h3>Next Steps:</h3>
        <ul>
          <li>Start a conversation to plan your first session</li>
          <li>Schedule a time that works for both of you</li>
          <li>Choose between online or in-person meeting</li>
        </ul>
        
        <p>
          <a href="${process.env.CLIENT_URL}/matches/${match._id}" 
             style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Start Conversation
          </a>
        </p>
        
        <p>Happy learning!</p>
        <p>The SkillSwap Hub Team</p>
      </div>
    `;
    
    const text = `Your match request was accepted by ${accepter.firstName} ${accepter.lastName}! Start planning your skill exchange session.`;
    
    return this.sendEmail(user.email, subject, html, text);
  }

  async sendSessionReminderEmail(user, match, session) {
    const sessionDate = new Date(session.startTime).toLocaleDateString();
    const sessionTime = new Date(session.startTime).toLocaleTimeString();
    
    const subject = 'Upcoming Skill Exchange Session Reminder';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #f59e0b;">Session Reminder ⏰</h1>
        <p>Hi ${user.firstName},</p>
        
        <p>This is a reminder that you have a skill exchange session coming up!</p>
        
        <div style="margin: 20px 0; padding: 20px; background-color: #fef3c7; border-radius: 8px;">
          <h3>Session Details:</h3>
          <p><strong>Date:</strong> ${sessionDate}</p>
          <p><strong>Time:</strong> ${sessionTime}</p>
          <p><strong>Type:</strong> ${session.type}</p>
          ${session.location ? `<p><strong>Location:</strong> ${session.location}</p>` : ''}
          <p><strong>Skill:</strong> ${match.skillOffered.name}</p>
        </div>
        
        <p>Make sure you're prepared and ready to share your knowledge or learn something new!</p>
        
        <p>
          <a href="${process.env.CLIENT_URL}/matches/${match._id}" 
             style="background-color: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            View Session Details
          </a>
        </p>
        
        <p>See you there!</p>
        <p>The SkillSwap Hub Team</p>
      </div>
    `;
    
    const text = `Reminder: You have a skill exchange session on ${sessionDate} at ${sessionTime} for ${match.skillOffered.name}.`;
    
    return this.sendEmail(user.email, subject, html, text);
  }

  async sendPaymentNotification(user, transaction, fromUser) {
    const subject = 'Payment Received - SkillSwap Hub';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #10b981;">Payment Received! 💰</h1>
        <p>Hi ${user.firstName},</p>
        
        <p>You've received a payment for your skill exchange!</p>
        
        <div style="margin: 20px 0; padding: 20px; background-color: #ecfdf5; border-radius: 8px;">
          <h3>Payment Details:</h3>
          <p><strong>Amount:</strong> ${transaction.amount} tokens</p>
          <p><strong>From:</strong> ${fromUser.firstName} ${fromUser.lastName}</p>
          <p><strong>For:</strong> ${transaction.description}</p>
        </div>
        
        <p>Your new token balance will be updated in your account.</p>
        
        <p>
          <a href="${process.env.CLIENT_URL}/wallet" 
             style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            View Wallet
          </a>
        </p>
        
        <p>Keep up the great work!</p>
        <p>The SkillSwap Hub Team</p>
      </div>
    `;
    
    const text = `You've received ${transaction.amount} tokens from ${fromUser.firstName} ${fromUser.lastName} for ${transaction.description}.`;
    
    return this.sendEmail(user.email, subject, html, text);
  }

  async sendPasswordResetEmail(user, resetToken) {
    const subject = 'Reset Your SkillSwap Hub Password';
    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #4f46e5;">Password Reset Request</h1>
        <p>Hi ${user.firstName},</p>
        
        <p>We received a request to reset your password for your SkillSwap Hub account.</p>
        
        <p>
          <a href="${resetUrl}" 
             style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Reset Password
          </a>
        </p>
        
        <p>This link will expire in 1 hour for security reasons.</p>
        
        <p>If you didn't request this password reset, please ignore this email.</p>
        
        <p>The SkillSwap Hub Team</p>
      </div>
    `;
    
    const text = `Reset your SkillSwap Hub password: ${resetUrl}`;
    
    return this.sendEmail(user.email, subject, html, text);
  }
}

module.exports = new EmailService();
