import bcrypt from 'bcryptjs';
import { ApiError } from '../utils/ApiError.js';
import { getRepo } from '../repositories/index.js';
import { signToken } from '../middleware/auth.js';
import { publicUser } from '../utils/serialize.js';

export async function register(req, res) {
  const { name, email, password } = req.body;
  const repo = getRepo();
  if (await repo.users.findByEmail(email)) throw new ApiError(409, 'An account with this email already exists. Please log in.', 'EMAIL_TAKEN');
  const user = await repo.users.create({ name, email, passwordHash: await bcrypt.hash(password, 10), geminiKey: '' });
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
}

export async function login(req, res) {
  const { email, password } = req.body;
  const user = await getRepo().users.findByEmail(email);
  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) throw new ApiError(401, 'Incorrect email or password.', 'BAD_LOGIN');
  res.json({ token: signToken(user), user: publicUser(user) });
}

export const me = (req, res) => res.json({ user: publicUser(req.user) });
