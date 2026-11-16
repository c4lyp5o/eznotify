import { createApp } from "../backend/app.js";
import { openStore } from "../backend/store.js";

const s = openStore(":memory:", Buffer.alloc(32, 4));
createApp(s, "preview-only-not-a-real-secret").listen({
	hostname: "127.0.0.1",
	port: 5099,
});
console.log("preview ready");
