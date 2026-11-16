export function routeSnapshot(data, routeId) {
	const route = data.routes.find((r) => r.id === routeId);
	if (!route) return null;
	const sources = data.sources.filter((s) => s.route === route.id);
	const destinations = data.destinations.filter((d) =>
		route.destinations.includes(d.id),
	);
	// Immutable route captured at intake; legacy records remain unattributed.
	const jobs = data.jobs.filter((j) => j.route === route.id);
	return { route, sources, destinations, jobs };
}
export function deliveryCounts(jobs) {
	return jobs.reduce(
		(counts, job) => {
			if (Object.hasOwn(counts, job.state)) counts[job.state]++;
			return counts;
		},
		{ delivered: 0, pending: 0, failed: 0 },
	);
}
