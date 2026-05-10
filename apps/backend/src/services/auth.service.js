import bcrypt from "bcrypt";
import { prisma } from "@crm/database";
import { signAccessToken } from "../utils/jwt.js";
import { AppError } from "../utils/app-error.js";

export async function loginWithEmailPassword({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError("Credenciales invalidas.", 401);
  }

  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    throw new AppError("Credenciales invalidas.", 401);
  }

  const token = signAccessToken({ sub: user.id, role: user.role });

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  };
}
