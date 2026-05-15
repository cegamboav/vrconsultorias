import { Router } from "express";
import * as serviceCategoriesController from "../../controllers/service-categories.controller.js";
import { requireRole } from "../../middlewares/auth.middleware.js";

const serviceCategoriesRouter = Router();

serviceCategoriesRouter.get("/", serviceCategoriesController.listActive);
serviceCategoriesRouter.get("/all", serviceCategoriesController.listAll);

serviceCategoriesRouter.post("/", requireRole("ADMIN"), serviceCategoriesController.create);
serviceCategoriesRouter.patch("/:id", requireRole("ADMIN"), serviceCategoriesController.update);
serviceCategoriesRouter.patch(
  "/:id/active",
  requireRole("ADMIN"),
  serviceCategoriesController.toggleActive
);

export default serviceCategoriesRouter;
