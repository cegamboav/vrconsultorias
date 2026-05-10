import { prisma } from "@crm/database";
import { verifyAccessToken } from "../utils/jwt.js";

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization ?? "";
    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ message: "No autorizado." });
    }

    const decoded = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true, name: true, email: true, role: true }
    });

    if (!user) {
      return res.status(401).json({ message: "Token invalido." });
    }

    req.user = user;
    return next();
  } catch (_error) {
    return res.status(401).json({ message: "Token invalido o expirado." });
  }
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "No autorizado." });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "No tienes permisos para esta accion." });
    }

    return next();
  };
}
