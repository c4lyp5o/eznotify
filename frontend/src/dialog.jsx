import { X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import React, { useEffect, useRef } from "react";
import { Button } from "./ui.jsx";

// Modal with the ezllm guards: Escape closes, a busy save blocks close,
// focus is trapped inside and returns to the opener on close.
export function Dialog({
	open,
	title,
	onClose,
	busy = false,
	dirty = false,
	children,
	width = "max-w-[560px]",
}) {
	const reduced = useReducedMotion();
	const panel = useRef(null);
	const opener = useRef(null);

	useEffect(() => {
		if (!open) return undefined;
		opener.current = document.activeElement;
		const first = panel.current?.querySelector(
			"input,select,textarea,button:not([aria-label='Close'])",
		);
		first?.focus();
		function onKey(e) {
			if (e.key === "Escape") {
				e.preventDefault();
				requestClose();
			}
			if (e.key === "Tab" && panel.current) {
				const items = [
					...panel.current.querySelectorAll(
						"button,input,select,textarea,a[href]",
					),
				].filter((n) => !n.disabled);
				if (!items.length) return;
				const a = items[0];
				const z = items[items.length - 1];
				if (e.shiftKey && document.activeElement === a) {
					e.preventDefault();
					z.focus();
				} else if (!e.shiftKey && document.activeElement === z) {
					e.preventDefault();
					a.focus();
				}
			}
		}
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("keydown", onKey);
			opener.current?.focus?.();
		};
	}, [open]); // eslint-disable-line react-hooks/exhaustive-deps

	function requestClose() {
		if (busy) return;
		if (dirty && !window.confirm("Discard unsaved changes?")) return;
		onClose();
	}

	if (!open) return null;
	return (
		<div
			className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-overlay p-4 pt-[8vh]"
			onMouseDown={(e) => e.target === e.currentTarget && requestClose()}
		>
			<motion.div
				initial={{ opacity: 0, y: reduced ? 0 : 12 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: reduced ? 0 : 0.22 }}
				ref={panel}
				role="dialog"
				aria-modal="true"
				aria-label={title}
				className={
					"w-full rounded-md border border-line bg-surface p-6 shadow-xl " +
					width
				}
			>
				<div className="mb-4 flex items-center justify-between gap-3">
					<h2 className="text-[16px] font-semibold text-ink">{title}</h2>
					<Button
						aria-label="Close"
						onClick={requestClose}
						disabled={busy}
						className="!h-8 !w-8 !px-0"
					>
						<X size={15} />
					</Button>
				</div>
				<div className="dialog-body">{children}</div>
			</motion.div>
		</div>
	);
}

export function FormError({ message }) {
	if (!message) return null;
	return (
		<p role="alert" className="text-[13px] text-bad">
			{message}
		</p>
	);
}
