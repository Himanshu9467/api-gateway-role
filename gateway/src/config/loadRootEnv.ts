import path from "node:path";
import dotenv from "dotenv";

export const rootEnvPath = path.resolve(__dirname, "../../../.env");

dotenv.config({ path: rootEnvPath, quiet: true });
