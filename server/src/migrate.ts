import { migrate } from "./db";

await migrate();
console.log("[db] migrations complete");
process.exit(0);
