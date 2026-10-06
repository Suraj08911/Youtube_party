import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { env } from '../config/env';
import { User } from './models/User.model';
import { Room } from './models/Room.model';
import { logger } from '../utils/logger';

const seed = async () => {
  await mongoose.connect(env.MONGODB_URI);
  logger.info('Connected to DB for seeding...');

  await User.deleteMany({});
  await Room.deleteMany({});

  const passwordHash = await bcrypt.hash('password123', 12);

  const users = await User.insertMany([
    { username: 'host1', email: 'host1@test.com', passwordHash },
    { username: 'mod1', email: 'mod1@test.com', passwordHash },
    { username: 'user1', email: 'user1@test.com', passwordHash },
  ]);

  logger.info(`✅ Seeded ${users.length} users (password: password123)`);

  await mongoose.connection.close();
  process.exit(0);
};

seed().catch((err) => {
  logger.error(`Seed failed: ${err.message}`);
  process.exit(1);
});