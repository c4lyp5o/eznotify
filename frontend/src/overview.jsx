import { motion, useAnimationControls, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

function ObservedCount({ value }) {
	const previous = useRef(value);
	const controls = useAnimationControls();
	const reduced = useReducedMotion();
	useEffect(() => {
		if (previous.current !== value && !reduced)
			controls.start({ opacity: [0.45, 1], transition: { duration: 0.35 } });
		previous.current = value;
	}, [value, reduced, controls]);
	return <motion.strong animate={controls}>{fmt(value)}</motion.strong>;
}

import { Delivery } from "./panels.jsx";
import { deliveryCounts, routeSnapshot } from "./switchboard.js";
import { Button, Chip, Empty, fmt, Section } from "./ui.jsx";

export default function Overview({
	data,
	busy,
	onRefresh,
	onRetry,
	onNavigate,
	updated,
	syncError,
}) {
	const [selected, setSelected] = useState(null);
	const reduced = useReducedMotion();
	const snapshot =
		routeSnapshot(data, selected) || routeSnapshot(data, data.routes[0]?.id);
	const counts = deliveryCounts(data.jobs);
	const [attention, setAttention] = useState(true);
	const visible = attention
		? data.jobs.filter((j) => j.state !== "delivered")
		: data.jobs;
	const columns = snapshot
		? [
				{
					title: "Sources",
					items: snapshot.sources.map((s) => ({
						...s,
						detail: s.revoked ? "Revoked" : "Active",
					})),
				},
				{
					title: "Route",
					items: [
						{
							...snapshot.route,
							detail:
								"Fan-out · " +
								snapshot.destinations.length +
								(snapshot.destinations.length === 1
									? " destination"
									: " destinations"),
						},
					],
				},
				{
					title: "Destinations",
					items: snapshot.destinations.map((d) => {
						const c = deliveryCounts(
							snapshot.jobs.filter((j) => j.destination === d.id),
						);
						return { ...d, detail: d.kind, counts: c };
					}),
				},
			]
		: [];
	return (
		<div className="overview">
			<div className="overview-summary" aria-label="Delivery snapshot">
				{Object.entries(counts).map(([state, count]) => (
					<div key={state}>
						<span>{state}</span>
						<ObservedCount value={count} />
					</div>
				))}
				<p>
					Latest 100 jobs
					<br />
					{syncError
						? "Refresh failed · showing stale data"
						: updated
							? "Updated " + new Date(updated).toLocaleTimeString()
							: "Loading"}
				</p>
				<Button disabled={busy} onClick={onRefresh}>
					Refresh overview
				</Button>
			</div>
			<Section
				title="Notification switchboard"
				aside={<Chip>{fmt(data.routes.length)} routes</Chip>}
			>
				<p className="text-[13px] text-mute mb-4">
					Your configured paths. Select a route to inspect its branches.
				</p>
				{!snapshot ? (
					<Empty
						title="Build your first notification path"
						hint="Connect a destination, create a route, then generate credentials for a source."
					/>
				) : (
					<>
						<div className="route-picker" aria-label="Select route">
							{data.routes.map((r) => (
								<Button
									key={r.id}
									aria-pressed={snapshot.route.id === r.id}
									variant={snapshot.route.id === r.id ? "primary" : "ghost"}
									onClick={() => setSelected(r.id)}
								>
									{r.name}
								</Button>
							))}
						</div>
						<motion.div
							key={snapshot.route.id}
							initial={{ opacity: reduced ? 1 : 0 }}
							animate={{ opacity: 1 }}
							transition={{ duration: reduced ? 0 : 0.22 }}
							className="switchboard"
						>
							{columns.map((column, i) => (
								<div className="switchboard-column" key={column.title}>
									<h3>{column.title}</h3>
									{column.items.length === 0 && (
										<p className="text-mute text-[13px]">
											No {column.title.toLowerCase()} connected
										</p>
									)}
									{column.items.map((item) => (
										<button
											type="button"
											className="switchboard-node"
											key={item.id}
											onClick={() =>
												onNavigate(
													column.title === "Route" ? "Routes" : column.title,
												)
											}
										>
											<span className="node-port" aria-hidden="true" />
											<strong>{item.name}</strong>
											<span>{item.detail}</span>
											{item.counts && (
												<span className="node-outcomes">
													{item.counts.failed} failed · {item.counts.pending}{" "}
													pending · {item.counts.delivered} delivered
												</span>
											)}
										</button>
									))}
									{i < 2 && (
										<svg
											className="switchboard-link"
											viewBox="0 0 64 24"
											aria-hidden="true"
										>
											<path
												d="M0 12 H60 M54 6 L60 12 L54 18"
												fill="none"
												stroke="currentColor"
												strokeWidth="1"
											/>
										</svg>
									)}
								</div>
							))}
						</motion.div>
						<p className="text-[12px] text-mute mt-4">
							Outcomes belong to this route at intake. Legacy jobs without route
							attribution remain in delivery history.
						</p>
					</>
				)}
				<div className="overview-links">
					{["Destinations", "Routes", "Sources"].map((tab) => (
						<Button key={tab} onClick={() => onNavigate(tab)}>
							Manage {tab.toLowerCase()}
						</Button>
					))}
				</div>
			</Section>
			<div className="overview-deliveries">
				<div className="route-picker">
					<Button
						aria-pressed={attention}
						variant={attention ? "primary" : "ghost"}
						onClick={() => setAttention(true)}
					>
						Needs attention
					</Button>
					<Button
						aria-pressed={!attention}
						variant={!attention ? "primary" : "ghost"}
						onClick={() => setAttention(false)}
					>
						All deliveries
					</Button>
				</div>
				<Delivery
					data={{ ...data, jobs: visible }}
					busy={busy}
					onRefresh={onRefresh}
					onRetry={onRetry}
				/>
			</div>
		</div>
	);
}
