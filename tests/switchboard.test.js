import { expect, test } from "bun:test";
import { deliveryCounts, routeSnapshot } from "../frontend/src/switchboard.js";

test("switchboard resolves configured branches without claiming source attribution", () => {
	const data = {
		routes: [{ id: "r", destinations: ["d"] }],
		sources: [
			{ id: "s", route: "r" },
			{ id: "other", route: "else" },
		],
		destinations: [{ id: "d" }, { id: "x" }],
		jobs: [
			{ destination: "d", route: "r", state: "failed" },
			{ destination: "d", route: "else", state: "delivered" },
			{ destination: "d", route: null, state: "failed" },
			{ destination: "x", state: "delivered" },
		],
	};
	const snapshot = routeSnapshot(data, "r");
	expect(snapshot.sources.map((s) => s.id)).toEqual(["s"]);
	expect(snapshot.destinations.map((d) => d.id)).toEqual(["d"]);
	expect(snapshot.jobs.length).toBe(1);
	expect(routeSnapshot(data, "missing")).toBeNull();
});
test("counts distinguish pending, failed, delivered and ignore unknown states", () => {
	expect(
		deliveryCounts([
			{ state: "failed" },
			{ state: "pending" },
			{ state: "delivered" },
			{ state: "failed" },
			{ state: "unknown" },
		]),
	).toEqual({ failed: 2, pending: 1, delivered: 1 });
	expect(deliveryCounts([])).toEqual({ failed: 0, pending: 0, delivered: 0 });
});
