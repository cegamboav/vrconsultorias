import app from "./app.js";
import { env } from "./config/env.js";
import { startFollowUpAgent } from "./jobs/follow-up.scheduler.js";

app.listen(env.port, () => {
  console.log(`API running on http://localhost:${env.port}`);
  startFollowUpAgent();
});
