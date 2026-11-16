// Exact origins, not suffixes: self-hosted endpoints must be explicitly trusted.
export function outboundTransport(origins = "", transport = fetch) {
	const allowed = new Set([
		"https://discord.com",
		"https://discordapp.com",
		"https://api.telegram.org",
	]);
	for (const value of origins.split(",").filter(Boolean)) {
		const url = new URL(value.trim());
		if (
			url.protocol !== "https:" ||
			url.username ||
			url.password ||
			url.pathname !== "/" ||
			url.search ||
			url.hash
		)
			throw new Error("Outbound allowlist requires HTTPS origins");
		allowed.add(url.origin);
	}
	return (input, options = {}) => {
		const url = new URL(input);
		if (url.username || url.password || !allowed.has(url.origin))
			throw Object.assign(new Error("Outbound origin denied"), {
				retryable: false,
			});
		return transport(url.href, { ...options, redirect: "error" });
	};
}
export async function limitedText(request, limit = 262144) {
	const reader = request.body?.getReader();
	if (!reader) return "";
	const chunks = [];
	let size = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			size += value.byteLength;
			if (size > limit) {
				await reader.cancel();
				throw Object.assign(new Error("Body too large"), { status: 413 });
			}
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}
	return Buffer.concat(chunks).toString("utf8");
}
