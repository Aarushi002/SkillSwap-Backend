const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const fixAvatarUrls = async () => {
  try {
    console.log('🔧 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find all users with avatar URLs that contain localhost
    const usersWithFullUrls = await User.find({
      avatar: { $regex: /^https?:\/\/[^\/]+/ }
    });

    console.log(`📊 Found ${usersWithFullUrls.length} users with full avatar URLs`);

    let fixedCount = 0;

    for (const user of usersWithFullUrls) {
      const originalAvatar = user.avatar;
      
      // Remove server URL from avatar path
      let cleanAvatar = originalAvatar.replace(/^https?:\/\/[^\/]+/, '');
      
      // Remove query parameters (cache busting)
      cleanAvatar = cleanAvatar.split('?')[0];

      // Update the user
      await User.findByIdAndUpdate(user._id, { avatar: cleanAvatar });
      
      console.log(`🔄 Fixed avatar for ${user.firstName} ${user.lastName}:`);
      console.log(`   Before: ${originalAvatar}`);
      console.log(`   After:  ${cleanAvatar}`);
      
      fixedCount++;
    }

    console.log(`✅ Successfully fixed ${fixedCount} avatar URLs`);
    
  } catch (error) {
    console.error('❌ Error fixing avatar URLs:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
};

// Run the fix
fixAvatarUrls();