import app from "./app";
import config from "./config";
import prisma from "./lib/prisma";

const PORT = Number(config.PORT) || 5000;

async function main() {
  try {
    await prisma.$connect();
    console.log("Connected to PostgreSQL database successfully.");

    const server = app.listen(PORT, () => {
      console.log(`Server is running at http://localhost:${PORT}`);
    });

    const exitHandler = () => {
      if (server) {
        server.close(async () => {
          console.log("Server closed.");
          await prisma.$disconnect();
          process.exit(0);
        });
      } else {
        process.exit(0);
      }
    };

    process.on("SIGTERM", exitHandler);
    process.on("SIGINT", exitHandler);
  } catch (error) {
    console.error("Error starting server:", error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();

export default app;
