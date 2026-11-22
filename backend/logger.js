import path from "node:path";
import { dataDir } from "./datadir.js";
import { createLogger } from "./ezlog.js";

export const logger = createLogger(
	path.join(dataDir(path.join(import.meta.dir, "..")), "logs"),
	"eznotify",
);
