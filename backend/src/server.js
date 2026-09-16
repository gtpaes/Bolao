const { createApp } = require("./app");
const config = require("./config/env");
const { connectDb } = require("./config/db");
const logger = require("./config/logger");
const { startJobs } = require("./services/scheduler");

async function main() {
  await connectDb();
  if (process.env.SKIP_JOBS !== "1") startJobs();
  const app = createApp();
  app.listen(config.port, () => {
    logger.info(`bolao-backend ouvindo em :${config.port} (${config.nodeEnv})`);
  });
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
