import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export function hashPassword(password) {
  return bcrypt.hash(String(password), SALT_ROUNDS);
}

export function verifyPassword(password, hash) {
  return bcrypt.compare(String(password), hash);
}
