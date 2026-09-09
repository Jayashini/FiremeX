import { useState } from 'preact/hooks'
import { API } from '../../api'

type Props = {
	entityId: string
	className?: string
	alt?: string
	/** Milliseconds to wait after a frame arrives before asking for the next. */
	interval?: number
}

// A live camera tile, built from still frames rather than a video stream.
//
// The important detail is that the next frame is requested only once the
// current one has finished loading. A plain setInterval queues requests faster
// than a slow camera can answer them - a generic RTSP camera can take several
// seconds per frame - and they pile up until Home Assistant is overwhelmed.
// Chaining on load means there is never more than one request outstanding per
// tile, whatever the camera's speed.
export function CameraFrame({ entityId, className, alt, interval = 1000 }: Props) {
	const [frame, setFrame] = useState(0)
	const [failed, setFailed] = useState(false)

	const scheduleNext = () => {
		window.setTimeout(() => setFrame((n) => n + 1), interval)
	}

	return (
		<>
			<img
				src={`${API}cameras/snapshot/${entityId}?frame=${frame}`}
				alt={alt ?? entityId}
				class={className}
				onLoad={() => {
					setFailed(false)
					scheduleNext()
				}}
				onError={() => {
					// Keep retrying - a camera that is briefly unavailable should
					// recover on its own without the operator reloading the page.
					setFailed(true)
					scheduleNext()
				}}
			/>
			{failed && (
				<span class="absolute inset-0 flex items-center justify-center text-xs text-slate-500 pointer-events-none">
					No signal
				</span>
			)}
		</>
	)
}
