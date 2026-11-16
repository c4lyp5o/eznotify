import { AlertTriangle, X } from "lucide-react";
import { motion } from "motion/react";
import React from "react";

export function cx(...parts) {
	return parts.filter(Boolean).join(" ");
}

// Figures are never abbreviated; a missing value is a grey dash.
export function fmt(n) {
	return n === null || n === undefined
		? "–"
		: Number(n).toLocaleString("en-US");
}

export const STATE = {
	delivered: { label: "Delivered", tone: "ok", rank: 3 },
	pending: { label: "Pending", tone: "neutral", rank: 1 },
	failed: { label: "Failed", tone: "bad", rank: 0 },
};

const TONES = {
	neutral: "border-transparent bg-raised text-dim",
	accent: "border-transparent bg-accent-dim text-accent",
	ok: "border-transparent bg-ok-dim text-ok",
	warn: "border-transparent bg-warn-dim text-warn",
	bad: "border-transparent bg-bad-dim text-bad",
};

export function Chip({ tone = "neutral", children, title }) {
	return (
		<span
			title={title}
			className={cx(
				"inline-flex flex-none items-center gap-1 whitespace-nowrap rounded-full border px-2 py-[3px] text-[12px] font-medium leading-none",
				TONES[tone],
			)}
		>
			{children}
		</span>
	);
}

export const btn = {
	base: "control",
	primary: "control-primary",
	ghost: "control-ghost",
	danger: "control-danger",
};

export function Button({ variant = "ghost", className, ...props }) {
	return (
		<motion.button
			whileTap={{ y: 1 }}
			type="button"
			{...props}
			className={cx(btn.base, btn[variant], className)}
		/>
	);
}

// One filled primary per screen; the ink colour inverted, never the accent.
export function Section({ title, aside, children }) {
	return (
		<section className="collection">
			{(title || aside) && (
				<div className="collection-heading">
					{title && (
						<h2 className="text-[15px] font-semibold text-ink">{title}</h2>
					)}
					{aside}
				</div>
			)}
			{children}
		</section>
	);
}

// A dashed frame that says "nothing yet" in one sentence, never a blank stage.
export function Empty({ title, hint, action }) {
	return (
		<div className="empty-state">
			<p className="text-[13px] text-dim">{title}</p>
			{hint && (
				<p className="max-w-prose text-[12px] leading-relaxed text-mute">
					{hint}
				</p>
			)}
			{action && <div className="mt-3">{action}</div>}
		</div>
	);
}

// The sidebar and tabs share one selection mark: a 1px accent line exactly as wide as the label.
export function Segmented({ options, value, onChange, label }) {
	return (
		<div
			role="group"
			aria-label={label}
			className="inline-flex flex-wrap items-center gap-1"
		>
			{options.map((o) => (
				<button
					key={o.key}
					type="button"
					aria-pressed={o.key === value}
					onClick={() => onChange(o.key)}
					className={cx(
						"rounded px-2 py-1 text-[13px] font-medium transition-colors hover:bg-hover",
						o.key === value ? "text-ink" : "text-mute hover:text-ink",
					)}
				>
					<span className="relative inline-block pb-px">
						{o.label}
						{o.key === value && (
							<span
								className="absolute inset-x-0 -bottom-px h-px bg-accent"
								aria-hidden
							/>
						)}
					</span>
				</button>
			))}
		</div>
	);
}

// Notice after a save, toggle or delete: says what happened, dismissable.
export function Notice({ tone = "neutral", children, onDismiss }) {
	if (!children) return null;
	const bar =
		tone === "bad"
			? "border-bad"
			: tone === "ok"
				? "border-ok"
				: "border-accent";
	return (
		<div
			role="status"
			className={cx(
				"mb-5 flex items-start gap-3 rounded-md border-l-2 bg-raised px-4 py-3 text-[13px] text-dim",
				bar,
			)}
		>
			<span className="flex-1">{children}</span>
			{onDismiss && (
				<button
					type="button"
					aria-label="Dismiss"
					onClick={onDismiss}
					className="-m-1 rounded p-1 text-mute hover:text-ink"
				>
					<X size={14} />
				</button>
			)}
		</div>
	);
}

export function Attention({ count }) {
	if (!count) return null;
	return (
		<span className="inline-flex items-center gap-1.5 text-[13px] text-bad">
			<AlertTriangle size={14} /> {fmt(count)} need attention
		</span>
	);
}
