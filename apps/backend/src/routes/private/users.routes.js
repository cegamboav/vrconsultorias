import { Router } from "express";
import { requireRole } from "../../middlewares/auth.middleware.js";
import * as usersController from "../../controllers/users.controller.js";

const usersRouter = Router();

// Todo el módulo de usuarios requiere rol ADMIN.
usersRouter.use(requireRole("ADMIN"));

usersRouter.get("/", usersController.list);
usersRouter.post("/", usersController.create);
usersRouter.patch("/:id", usersController.update);
usersRouter.patch("/:id/active", usersController.toggleActive);
usersRouter.post("/:id/password", usersController.resetPassword);

export default usersRouter;
