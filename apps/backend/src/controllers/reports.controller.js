import { asyncHandler } from "../utils/async-handler.js";
import { getReportsSnapshot } from "../services/reports.service.js";

function parseIsoDate(value) {
  if (value === undefined || value === null || value === "") return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

export const snapshot = asyncHandler(async (req, res) => {
  const from = parseIsoDate(req.query?.from);
  const to = parseIsoDate(req.query?.to);
  const data = await getReportsSnapshot({ from, to });
  res.status(200).json(data);
});
