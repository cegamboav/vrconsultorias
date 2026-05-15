import { asyncHandler } from "../utils/async-handler.js";
import { listActiveServiceCategories } from "../services/service-categories.service.js";

export const listActive = asyncHandler(async (_req, res) => {
  const categories = await listActiveServiceCategories();
  res.status(200).json({ categories });
});
