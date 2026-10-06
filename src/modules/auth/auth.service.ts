import bcrypt from 'bcryptjs';
import { User, IUser } from '../../db/models/User.model';
import { ApiError } from '../../utils/ApiError';
import { signToken, JwtPayload } from '../../utils/jwt';
import { RegisterInput, LoginInput } from './auth.validation';

interface AuthResult {
  user: {
    id: string;
    username: string;
    email: string;
  };
  token: string;
}

const buildAuthResult = (user: IUser): AuthResult => {
  const payload: JwtPayload = {
    userId: user._id.toString(),
    username: user.username,
    email: user.email,
  };

  return {
    user: {
      id: user._id.toString(),
      username: user.username,
      email: user.email,
    },
    token: signToken(payload),
  };
};

export const registerUser = async (input: RegisterInput): Promise<AuthResult> => {
  const { username, email, password } = input;

  const existing = await User.findOne({
    $or: [{ email: email.toLowerCase() }, { username }],
  });

  if (existing) {
    if (existing.email === email.toLowerCase()) {
      throw ApiError.conflict('Email already registered');
    }
    throw ApiError.conflict('Username already taken');
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await User.create({
    username,
    email: email.toLowerCase(),
    passwordHash,
  });

  return buildAuthResult(user);
};

export const loginUser = async (input: LoginInput): Promise<AuthResult> => {
  const { email, password } = input;

  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');

  if (!user) {
    throw ApiError.unauthorized('Invalid credentials');
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw ApiError.unauthorized('Invalid credentials');
  }

  return buildAuthResult(user);
};

export const getCurrentUser = async (userId: string) => {
  const user = await User.findById(userId).lean();
  if (!user) throw ApiError.notFound('User not found');

  return {
    id: user._id.toString(),
    username: user.username,
    email: user.email,
    createdAt: user.createdAt,
  };
};