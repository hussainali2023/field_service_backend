import bcrypt from "bcryptjs";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import { Role, UserStatus } from "../../../prisma/generated/prisma/enums";
import config from "../../config";
import prisma from "../../lib/prisma";
import { getCache, setCache, deleteCache } from "../../lib/redis";
import { AppError } from "../../utils/appError";
import { logAudit } from "../../utils/auditLogger";
import { createTokenPair, signAccessToken, verifyRefreshToken } from "../../utils/jwt";

const googleClient = new OAuth2Client(config.GOOGLE_CLIENT_ID);

export const registerUser = async (payload: {
  name: string;
  email: string;
  password: string;
  phone?: string;
  role?: "CUSTOMER" | "TECHNICIAN";
  skills?: string[];
  experienceYears?: number;
  hourlyRate?: number;
  serviceArea?: string;
}) => {
  const existingUser = await prisma.user.findUnique({
    where: { email: payload.email.toLowerCase() },
  });

  if (existingUser) {
    throw new AppError(409, "User with this email already exists");
  }

  const hashedPassword = await bcrypt.hash(payload.password, config.BCRYPT_SALT_ROUNDS);
  const targetRole = payload.role === "TECHNICIAN" ? Role.TECHNICIAN : Role.CUSTOMER;

  const newUser = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: payload.name,
        email: payload.email.toLowerCase(),
        password: hashedPassword,
        phone: payload.phone,
        role: targetRole,
        status: UserStatus.ACTIVE,
      },
    });

    if (targetRole === Role.TECHNICIAN) {
      await tx.technicianProfile.create({
        data: {
          userId: user.id,
          skills: payload.skills && payload.skills.length > 0 ? payload.skills : ["General Repair"],
          experienceYears: payload.experienceYears || 1,
          hourlyRate: payload.hourlyRate || 35.0,
          serviceArea: payload.serviceArea || "Metro Area",
        },
      });
    }

    return user;
  });

  const fullUser = await prisma.user.findUnique({
    where: { id: newUser.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      phone: true,
      avatar: true,
      createdAt: true,
      technicianProfile: true,
    },
  });

  const tokens = createTokenPair({
    id: fullUser!.id,
    email: fullUser!.email,
    role: fullUser!.role,
  });

  await logAudit({
    userId: fullUser!.id,
    action: "USER_REGISTERED",
    entity: "User",
    entityId: fullUser!.id,
    details: { email: fullUser!.email, role: fullUser!.role },
  });

  return { user: fullUser, ...tokens };
};

export const loginUser = async (payload: { email: string; password: string }) => {
  const user = await prisma.user.findUnique({
    where: { email: payload.email.toLowerCase() },
    include: { technicianProfile: true },
  });

  if (!user || user.isDeleted) {
    throw new AppError(401, "Invalid email or password");
  }

  if (user.status === UserStatus.BLOCKED || user.status === UserStatus.SUSPENDED) {
    throw new AppError(403, `Account is ${user.status.toLowerCase()}. Contact support.`);
  }

  const isPasswordMatch = await bcrypt.compare(payload.password, user.password);
  if (!isPasswordMatch) {
    throw new AppError(401, "Invalid email or password");
  }

  const tokens = createTokenPair({
    id: user.id,
    email: user.email,
    role: user.role,
  });

  const { password: _, ...userWithoutPassword } = user;

  await logAudit({
    userId: user.id,
    action: "USER_LOGGED_IN",
    entity: "User",
    entityId: user.id,
  });

  return { user: userWithoutPassword, ...tokens };
};

export const googleLogin = async (payload: { idToken?: string; email?: string; name?: string }) => {
  let email = payload.email;
  let name = payload.name || "Google User";

  if (payload.idToken && config.GOOGLE_CLIENT_ID) {
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: payload.idToken,
        audience: config.GOOGLE_CLIENT_ID,
      });
      const tokenPayload = ticket.getPayload();
      if (tokenPayload?.email) {
        email = tokenPayload.email;
        name = tokenPayload.name || name;
      }
    } catch {
      throw new AppError(401, "Google token verification failed");
    }
  }

  if (!email) {
    throw new AppError(400, "Google email or valid idToken is required");
  }

  let user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user) {
    const randomPassword = await bcrypt.hash(Math.random().toString(36).slice(-10), 10);
    user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        password: randomPassword,
        role: Role.CUSTOMER,
        status: UserStatus.ACTIVE,
      },
    });

    await logAudit({
      userId: user.id,
      action: "USER_REGISTERED_GOOGLE",
      entity: "User",
      entityId: user.id,
    });
  } else if (user.isDeleted || user.status !== UserStatus.ACTIVE) {
    throw new AppError(403, "Account is disabled or inactive");
  }

  const tokens = createTokenPair({
    id: user.id,
    email: user.email,
    role: user.role,
  });

  const { password: _, ...userWithoutPassword } = user;
  return { user: userWithoutPassword, ...tokens };
};

export const refreshToken = async (incomingToken: string) => {
  try {
    const decoded = verifyRefreshToken(incomingToken);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user || user.isDeleted || user.status !== UserStatus.ACTIVE) {
      throw new AppError(401, "Unauthorized - Invalid user for refresh token");
    }

    const newAccessToken = signAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    return { accessToken: newAccessToken };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(401, "Invalid or expired refresh token");
  }
};

export const getMe = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      technicianProfile: true,
    },
  });

  if (!user || user.isDeleted) {
    throw new AppError(404, "User profile not found");
  }

  const { password: _, ...userWithoutPassword } = user;
  return userWithoutPassword;
};

export const changePassword = async (
  userId: string,
  payload: { oldPassword: string; newPassword: string }
) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError(404, "User not found");
  }

  const isMatch = await bcrypt.compare(payload.oldPassword, user.password);
  if (!isMatch) {
    throw new AppError(400, "Current password does not match");
  }

  const hashedNewPassword = await bcrypt.hash(payload.newPassword, config.BCRYPT_SALT_ROUNDS);

  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedNewPassword },
  });

  await logAudit({
    userId,
    action: "PASSWORD_CHANGED",
    entity: "User",
    entityId: userId,
  });

  return { message: "Password updated successfully" };
};

export const forgotPassword = async (email: string) => {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user || user.isDeleted) {
    // Return friendly message even if email not found to avoid account enumeration
    return {
      message: "If an account exists with this email, password reset instructions have been generated.",
    };
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  const cacheKey = `pwd_reset:${normalizedEmail}`;

  // Store in Redis with 15 minutes expiration (900 seconds)
  await setCache(cacheKey, resetToken, 900);

  await logAudit({
    userId: user.id,
    action: "PASSWORD_RESET_REQUESTED",
    entity: "User",
    entityId: user.id,
    details: { email: normalizedEmail },
  });

  return {
    message: "Password reset token generated successfully. Valid for 15 minutes.",
    resetToken,
  };
};

export const resetPassword = async (payload: {
  email: string;
  token: string;
  newPassword: string;
}) => {
  const normalizedEmail = payload.email.toLowerCase().trim();
  const cacheKey = `pwd_reset:${normalizedEmail}`;

  const storedToken = await getCache<string>(cacheKey);

  if (!storedToken || storedToken !== payload.token) {
    throw new AppError(400, "Invalid or expired password reset token");
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user || user.isDeleted) {
    throw new AppError(404, "User not found");
  }

  const hashedNewPassword = await bcrypt.hash(payload.newPassword, config.BCRYPT_SALT_ROUNDS);

  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedNewPassword },
  });

  await deleteCache(cacheKey);

  await logAudit({
    userId: user.id,
    action: "PASSWORD_RESET_COMPLETED",
    entity: "User",
    entityId: user.id,
  });

  return { message: "Password reset successfully. You can now login with your new password." };
};

