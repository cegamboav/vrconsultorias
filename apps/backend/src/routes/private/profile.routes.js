import { Router } from "express";
import * as profileController from "../../controllers/profile.controller.js";

const profileRouter = Router();

profileRouter.get("/", profileController.get);
profileRouter.patch("/", profileController.update);
profileRouter.post("/password", profileController.changePassword);

export default profileRouter;
