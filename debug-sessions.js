const mongoose = require('mongoose');
const Match = require('./models/Match');

mongoose.connect('mongodb://localhost:27017/skillswap')
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

async function checkSessionDates() {
  try {
    const sessions = await Match.find({
      scheduledSession: { $exists: true }
    }).limit(3);

    console.log('Session data structure:');
    sessions.forEach((session, index) => {
      console.log(`\n--- Session ${index + 1} ---`);
      console.log('ID:', session._id);
      console.log('Start Time:', session.scheduledSession.startTime);
      console.log('Start Time Type:', typeof session.scheduledSession.startTime);
      console.log('Start Time toString:', session.scheduledSession.startTime?.toString());
      console.log('End Time:', session.scheduledSession.endTime);
      console.log('End Time Type:', typeof session.scheduledSession.endTime);
      console.log('End Time toString:', session.scheduledSession.endTime?.toString());
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkSessionDates();