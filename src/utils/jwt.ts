import jwt from "jsonwebtoken";
import type { Role } from "../../prisma/generated/prisma/enums";
import config from "../config";

export type UserJwtPayload = {
  id: string;
  email: string;
  role: Role;
};

function getExpiresIn(value: string): NonNullable<jwt.SignOptions["expiresIn"]> {
  return value as NonNullable<jwt.SignOptions["expiresIn"]>;
}

export function signAccessToken(payload: UserJwtPayload): string {
  return jwt.sign(payload, config.JWT_ACCESS_SECRET, {
    expiresIn: getExpiresIn(config.JWT_ACCESS_EXPIRES_IN),
  });
}

export function signRefreshToken(payload: UserJwtPayload): string {
  return jwt.sign(payload, config.JWT_REFRESH_SECRET, {
    expiresIn: getExpiresIn(config.JWT_REFRESH_EXPIRES_IN),
  });
}

export function createTokenPair(payload: UserJwtPayload) {
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}

export function verifyAccessToken(token: string): UserJwtPayload {
  return jwt.verify(token, config.JWT_ACCESS_SECRET) as UserJwtPayload;
}

export function verifyRefreshToken(token: string): UserJwtPayload {
  return jwt.verify(token, config.JWT_REFRESH_SECRET) as UserJwtPayload;
}
