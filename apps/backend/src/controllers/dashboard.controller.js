import { asyncHandler } from "../utils/async-handler.js";
import { getDashboardSnapshot } from "../services/dashboard.service.js";

export const snapshot = asyncHandler(async (_req, res) => {
  const data = await getDashboardSnapshot();
  res.status(200).json(data);
});
