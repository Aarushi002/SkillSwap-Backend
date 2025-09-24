# Database Scripts

This directory contains utility scripts for managing the SkillSwap Hub database.

## Scripts Available

### 🌱 Seed Database (`seedDatabase.js`)
Populates the database with realistic dummy data for development and testing.

**Usage:**
```bash
npm run seed
```

**What it creates:**
- **10 Users** with realistic profiles, skills, and preferences
- **~20 Matches** between users with different statuses
- **~15 Transactions** with various types and statuses
- **~30 Messages** creating conversations between users
- **~25 Notifications** of different types

**Test Credentials:**
- Email: `alice.johnson@example.com`
- Password: `password123`
- (All users have the same password for testing)

### 🧹 Clear Database (`clearDatabase.js`)
Removes all data from the database.

**Usage:**
```bash
npm run seed:clear
```

## Data Generated

### Users
- Realistic names, emails, and profiles
- Professional bios and experience descriptions
- Skills across 20 categories (Technology, Design, Business, etc.)
- Random availability schedules
- Hourly rates between $40-$100
- Random preferences and verification status

### Skills Categories
The script includes 20 professional skill categories:
- Technology & Programming
- Design & Creative
- Business & Finance
- Marketing & Sales
- Writing & Communication
- Education & Training
- Health & Wellness
- Music & Arts
- Languages
- Crafts & DIY
- Sports & Fitness
- Cooking & Culinary
- Photography & Video
- Consulting & Strategy
- Data & Analytics
- Engineering
- Legal & Compliance
- Project Management
- Customer Service
- Other

### Matches
- Random skill exchange requests
- Various statuses: pending, accepted, declined, completed
- Realistic messages and hourly rates

### Transactions
- Different types: skill_exchange, payment, refund
- Various statuses: pending, completed, failed
- Random amounts and descriptions

### Messages
- Conversation threads between users
- Realistic conversation flow
- Random read/unread status

### Notifications
- Different types: match_request, message, transaction, skill_verified, system
- Realistic titles and messages
- Random timestamps

## Requirements

Make sure you have:
1. MongoDB running locally or configured via `MONGODB_URI` environment variable
2. All required npm packages installed (`npm install`)
3. Environment variables configured (see `.env.example`)

## Usage Examples

```bash
# Seed the database with dummy data
npm run seed

# Clear all data from database
npm run seed:clear

# Or run directly with node
node scripts/seedDatabase.js
node scripts/clearDatabase.js
```

## Notes

- The seed script will clear existing data before creating new dummy data
- All users have the password `password123` for testing
- The script creates realistic timestamps (data appears to have been created over time)
- Skills are randomly distributed across categories with realistic level ratings
- User locations are randomly selected from major US cities

## Customization

You can modify the dummy data by editing:
- `SAMPLE_USERS` array for user profiles
- `SKILLS_BY_CATEGORY` object for available skills
- `CITIES` array for user locations
- Random generation parameters (counts, ranges, etc.)