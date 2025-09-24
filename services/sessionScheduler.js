const cron = require('node-cron');
const Match = require('../models/Match');
const User = require('../models/User');
const Notification = require('../models/Notification');
const emailService = require('./emailService');

class SessionScheduler {
  constructor() {
    this.reminderJobs = new Map(); // Store individual reminder jobs
    this.isRunning = false;
  }

  // Initialize the scheduler with all cron jobs
  start() {
    if (this.isRunning) {
      console.log('Session scheduler already running');
      return;
    }

    console.log('Starting session scheduler...');
    
    // Check for reminders every 5 minutes
    cron.schedule('*/5 * * * *', () => {
      this.checkSessionReminders();
    });

    // Update session statuses every minute
    cron.schedule('* * * * *', () => {
      this.updateSessionStatuses();
    });

    // Clean up old reminder jobs daily at midnight
    cron.schedule('0 0 * * *', () => {
      this.cleanupOldJobs();
    });

    this.isRunning = true;
    console.log('Session scheduler started successfully');
  }

  // Stop the scheduler
  stop() {
    this.reminderJobs.forEach(job => job.destroy());
    this.reminderJobs.clear();
    this.isRunning = false;
    console.log('Session scheduler stopped');
  }

  // Check for sessions that need reminders
  async checkSessionReminders() {
    try {
      const now = new Date();
      const reminderTime = new Date(now.getTime() + (24 * 60 * 60 * 1000)); // 24 hours from now
      
      // Find sessions starting in the next 24 hours that haven't been reminded
      const sessionsNeedingReminders = await Match.find({
        status: 'accepted',
        'scheduledSession.startTime': {
          $gte: now,
          $lte: reminderTime
        },
        'scheduledSession.reminderSent': { $ne: true }
      }).populate('requester receiver', 'firstName lastName email preferences');

      for (const match of sessionsNeedingReminders) {
        await this.sendSessionReminders(match);
      }
    } catch (error) {
      console.error('Error checking session reminders:', error);
    }
  }

  // Send reminders for a specific session
  async sendSessionReminders(match) {
    try {
      const session = match.scheduledSession;
      const participants = [match.requester, match.receiver];

      for (const user of participants) {
        // Check if user has reminder notifications enabled
        if (user.preferences?.notifications?.sessionReminders !== false) {
          // Send email reminder
          try {
            await emailService.sendSessionReminderEmail(user, match, session);
          } catch (emailError) {
            console.error(`Failed to send email reminder to ${user.email}:`, emailError);
          }

          // Create in-app notification
          const notification = new Notification({
            recipient: user._id,
            type: 'session_reminder',
            title: 'Upcoming Session Reminder',
            message: `You have a ${match.skillOffered.name} session scheduled for ${new Date(session.startTime).toLocaleString()}`,
            data: {
              matchId: match._id,
              sessionStartTime: session.startTime,
              sessionType: session.type,
              location: session.location
            }
          });

          await notification.save();
        }
      }

      // Mark reminder as sent
      match.scheduledSession.reminderSent = true;
      await match.save();

      console.log(`Reminders sent for session ${match._id}`);
    } catch (error) {
      console.error('Error sending session reminders:', error);
    }
  }

  // Update session statuses based on current time
  async updateSessionStatuses() {
    try {
      const now = new Date();

      // Find sessions that should be marked as in-progress
      await Match.updateMany({
        status: 'accepted',
        'scheduledSession.startTime': { $lte: now },
        'scheduledSession.endTime': { $gt: now },
        'scheduledSession.status': { $ne: 'in-progress' }
      }, {
        $set: { 'scheduledSession.status': 'in-progress' }
      });

      // Find sessions that should be marked as completed (ended)
      const completedSessions = await Match.find({
        status: 'accepted',
        'scheduledSession.endTime': { $lte: now },
        'scheduledSession.status': { $ne: 'completed' }
      }).populate('requester receiver', 'firstName lastName');

      for (const match of completedSessions) {
        match.scheduledSession.status = 'completed';
        
        // Create notifications for session completion
        const participants = [match.requester, match.receiver];
        for (const user of participants) {
          const notification = new Notification({
            recipient: user._id,
            type: 'session_completed',
            title: 'Session Completed',
            message: `Your ${match.skillOffered.name} session has ended. Please rate your experience!`,
            data: {
              matchId: match._id,
              requiresRating: true
            }
          });
          await notification.save();
        }

        await match.save();
      }

      // Mark missed sessions (sessions that started more than 30 minutes ago without attendance)
      await Match.updateMany({
        status: 'accepted',
        'scheduledSession.startTime': { $lte: new Date(now.getTime() - 30 * 60 * 1000) },
        'scheduledSession.status': 'upcoming',
        'scheduledSession.attendance': { $exists: false }
      }, {
        $set: { 'scheduledSession.status': 'missed' }
      });

    } catch (error) {
      console.error('Error updating session statuses:', error);
    }
  }

  // Schedule a reminder for a specific session
  async scheduleSessionReminder(matchId, reminderTime) {
    try {
      // Create a specific cron job for this reminder
      const job = cron.schedule(`${reminderTime.getMinutes()} ${reminderTime.getHours()} ${reminderTime.getDate()} ${reminderTime.getMonth() + 1} *`, async () => {
        const match = await Match.findById(matchId).populate('requester receiver', 'firstName lastName email preferences');
        if (match && match.scheduledSession) {
          await this.sendSessionReminders(match);
        }
        // Remove job after execution
        this.reminderJobs.delete(matchId);
      }, {
        scheduled: false
      });

      this.reminderJobs.set(matchId, job);
      job.start();
      
      console.log(`Scheduled reminder for session ${matchId} at ${reminderTime}`);
    } catch (error) {
      console.error('Error scheduling session reminder:', error);
    }
  }

  // Clean up old reminder jobs
  cleanupOldJobs() {
    const now = new Date();
    this.reminderJobs.forEach((job, matchId) => {
      // Remove jobs that are more than a day old
      if (job.lastDate && (now - job.lastDate) > 24 * 60 * 60 * 1000) {
        job.destroy();
        this.reminderJobs.delete(matchId);
      }
    });
    console.log(`Cleaned up ${this.reminderJobs.size} old reminder jobs`);
  }

  // Process attendance for a session
  async markAttendance(matchId, userId, attended) {
    try {
      const match = await Match.findById(matchId);
      if (!match || !match.scheduledSession) {
        throw new Error('Session not found');
      }

      // Initialize attendance object if it doesn't exist
      if (!match.scheduledSession.attendance) {
        match.scheduledSession.attendance = {};
      }

      // Mark attendance
      match.scheduledSession.attendance[userId] = {
        attended,
        markedAt: new Date()
      };

      // Check if both participants have marked attendance
      const requesterAttended = match.scheduledSession.attendance[match.requester];
      const receiverAttended = match.scheduledSession.attendance[match.receiver];

      if (requesterAttended && receiverAttended) {
        // Both marked attendance, determine session outcome
        if (requesterAttended.attended && receiverAttended.attended) {
          match.scheduledSession.status = 'completed';
          // Trigger automatic payment if enabled
          await this.processSessionPayment(match);
        } else {
          match.scheduledSession.status = 'partial'; // One or both didn't attend
        }
      }

      await match.save();
      return match;
    } catch (error) {
      console.error('Error marking attendance:', error);
      throw error;
    }
  }

  // Process automatic payment after successful session
  async processSessionPayment(match) {
    try {
      // Only process payment if both users attended
      const attendance = match.scheduledSession.attendance;
      
      // Handle both Map and Object formats for attendance
      let requesterAttended, receiverAttended;
      
      if (attendance instanceof Map) {
        requesterAttended = attendance.get(match.requester._id.toString())?.attended;
        receiverAttended = attendance.get(match.receiver._id.toString())?.attended;
      } else {
        requesterAttended = attendance[match.requester._id.toString()]?.attended;
        receiverAttended = attendance[match.receiver._id.toString()]?.attended;
      }

      console.log(`Checking attendance for requester ${match.requester._id}: ${requesterAttended}`);
      console.log(`Checking attendance for receiver ${match.receiver._id}: ${receiverAttended}`);
      console.log(`Available attendance keys:`, attendance instanceof Map ? Array.from(attendance.keys()) : Object.keys(attendance));

      if (!requesterAttended || !receiverAttended) {
        console.log(`Payment not processed - attendance: requester=${requesterAttended}, receiver=${receiverAttended}`);
        return;
      }

      // Calculate payment based on session duration
      const duration = this.calculateSessionDuration(match);
      const hourlyRate = match.skillOffered.hourlyRate || 50; // Use actual hourly rate
      const amount = Math.min(Math.ceil((duration / 60) * hourlyRate), 200); // Cap at 200 tokens

      console.log(`Processing payment: ${amount} tokens for ${duration} minutes session`);

      // Create automatic payment from receiver to requester (learner pays teacher)
      const Transaction = require('../models/Transaction');
      
      const transaction = new Transaction({
        from: match.receiver._id,
        to: match.requester._id,
        amount,
        type: 'session_payment',
        description: `Automatic payment for completed ${match.skillOffered.name} session`,
        relatedMatch: match._id,
        status: 'completed',
        metadata: {
          skillName: match.skillOffered.name,
          sessionDuration: duration,
          sessionDate: match.scheduledSession.startTime,
          automatic: true
        }
      });

      await transaction.save();
      console.log(`Transaction created: ${transaction._id}`);

      // Update user balances
      await User.findByIdAndUpdate(match.receiver._id, {
        $inc: { tokenBalance: -amount }
      });

      await User.findByIdAndUpdate(match.requester._id, {
        $inc: { tokenBalance: amount }
      });

      console.log(`Balances updated: receiver -${amount}, requester +${amount}`);

      // Mark payment as processed
      match.scheduledSession.paymentProcessed = true;
      await match.save();
      console.log(`Payment marked as processed for session ${match._id}`);

      // Create notifications for payment
      const participants = [
        { user: match.requester._id, message: `You received ${amount} tokens for teaching ${match.skillOffered.name}` },
        { user: match.receiver._id, message: `You paid ${amount} tokens for learning ${match.skillOffered.name}` }
      ];

      for (const { user, message } of participants) {
        const notification = new Notification({
          recipient: user,
          type: 'session_payment',
          title: 'Session Payment Processed',
          message,
          data: {
            transactionId: transaction._id,
            amount,
            matchId: match._id
          }
        });
        await notification.save();
      }

      console.log(`Automatic payment processed for session ${match._id}: ${amount} tokens`);
    } catch (error) {
      console.error('Error processing session payment:', error);
    }
  }

  // Mark attendance for a session participant
  async markAttendance(sessionId, userId, attended, feedback = '') {
    try {
      const match = await Match.findById(sessionId)
        .populate('requester receiver', 'firstName lastName email');

      if (!match || !match.scheduledSession) {
        throw new Error('Session not found');
      }

      // Check if user is part of the session
      const isParticipant = match.requester._id.toString() === userId || 
                           match.receiver._id.toString() === userId;
      
      if (!isParticipant) {
        throw new Error('Not authorized to mark attendance for this session');
      }

      // Initialize attendance Map if it doesn't exist
      if (!match.scheduledSession.attendance) {
        match.scheduledSession.attendance = new Map();
      }

      // Mark attendance
      match.scheduledSession.attendance.set(userId, {
        attended,
        markedAt: new Date(),
        feedback: feedback.trim()
      });

      await match.save();

      // Check if both participants have marked attendance and update session status
      const requesterAttendance = match.scheduledSession.attendance.get(match.requester._id.toString());
      const receiverAttendance = match.scheduledSession.attendance.get(match.receiver._id.toString());

      if (requesterAttendance && receiverAttendance) {
        // Both have marked attendance, determine final session status
        const bothAttended = requesterAttendance.attended && receiverAttendance.attended;
        const neitherAttended = !requesterAttendance.attended && !receiverAttendance.attended;
        
        if (bothAttended) {
          match.scheduledSession.status = 'completed';
          // Trigger automatic payment processing
          if (!match.scheduledSession.paymentProcessed) {
            await this.processSessionPayment(match);
          }
        } else if (neitherAttended) {
          match.scheduledSession.status = 'missed';
        } else {
          match.scheduledSession.status = 'partial';
        }

        await match.save();
      }

      // Create notification for the other participant
      const otherParticipant = match.requester._id.toString() === userId ? 
                              match.receiver : match.requester;

      const attendanceNotification = new Notification({
        recipient: otherParticipant._id,
        type: attended ? 'session_completed' : 'session_missed',
        title: 'Session Attendance Updated',
        message: `${match.requester._id.toString() === userId ? match.requester.firstName : match.receiver.firstName} has marked their attendance for the ${match.skillOffered.name} session`,
        data: {
          matchId: match._id,
          userId,
          attended,
          skillName: match.skillOffered.name
        }
      });

      await attendanceNotification.save();

      console.log(`Attendance marked for session ${sessionId}, user ${userId}: ${attended ? 'attended' : 'no-show'}`);
      return match;
    } catch (error) {
      console.error('Error marking attendance:', error);
      throw error;
    }
  }

  // Calculate session duration in minutes
  calculateSessionDuration(match) {
    if (!match.scheduledSession?.startTime || !match.scheduledSession?.endTime) {
      return 0;
    }
    
    const start = new Date(match.scheduledSession.startTime);
    const end = new Date(match.scheduledSession.endTime);
    return Math.round((end - start) / (1000 * 60));
  }

  // Get scheduler statistics
  getStats() {
    return {
      isRunning: this.isRunning,
      activeReminderJobs: this.reminderJobs.size,
      uptime: this.isRunning ? process.uptime() : 0
    };
  }
}

module.exports = new SessionScheduler();