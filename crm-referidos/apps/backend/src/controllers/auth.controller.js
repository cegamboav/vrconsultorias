import bcrypt from "bcrypt";
import { prisma } from "@crm/database";
import { signAccessToken } from "../utils/jwt.js";

export async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email y password son requeridos." });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ message: "Credenciales invalidas." });
  }

  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    return res.status(401).json({ message: "Credenciales invalidas." });
  }

  const token = signAccessToken({ sub: user.id, role: user.role });
  return res.status(200).json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  });
}

export async function me(req, res) {
  return res.status(200).json({ user: req.user });
}
