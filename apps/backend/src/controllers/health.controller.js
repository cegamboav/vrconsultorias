export function getHealth(_req, res) {
  res.status(200).json({
    status: "ok",
    service: "crm-referidos-api",
    timestamp: new Date().toISOString()
  });
}
