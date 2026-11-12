import { JJD, JJET } from 'jj'

/** Directions a pointer or wheel can move in. */
const DIRECTIONS = ['up', 'down', 'left', 'right']

/** Directions a scroll wheel reports on its own axis. */
const SCROLL_DIRECTIONS = ['up', 'down']

/** Directions the scroll wheel reports when it tilts sideways. */
const TILT_DIRECTIONS = ['left', 'right']

/** Maps `MouseEvent.button` to the button it represents. */
const BUTTON_BY_INDEX = ['primary', 'wheel', 'secondary', 'back', 'forward']

/**
 * Some mice report a wheel tilt as buttons 6 (left) and 7 (right) instead of,
 * or in addition to, horizontal scroll deltas.
 */
const TILT_BY_BUTTON_INDEX = { 6: 'left', 7: 'right' }

/** Maps internal state keys to the classes that render them on the SVG. */
const CLASS_BY_DIRECTION = {
	up: 'is-up',
	down: 'is-down',
	left: 'is-left',
	right: 'is-right',
}

const CLASS_BY_SCROLL = {
	up: 'is-scroll-up',
	down: 'is-scroll-down',
}

const CLASS_BY_TILT = {
	left: 'is-tilt-left',
	right: 'is-tilt-right',
}

const CLASS_BY_BUTTON = {
	primary: 'is-primary',
	wheel: 'is-wheel',
	secondary: 'is-secondary',
	back: 'is-back',
	forward: 'is-forward',
}

/** Movement below this many pixels is treated as jitter, not a direction. */
const MOVE_THRESHOLD_PX = 1

/** How long a direction stays lit after the last movement in that direction. */
const DIRECTION_HOLD_MS = 140

/** How long the wheel nudge lasts after the last wheel step. */
const SCROLL_CUE_MS = 120

/**
 * How long the sideways wheel nudge lasts after a tilt. Tilt arrives as one or
 * two sparse detents, so it needs a longer cue than a scroll to stay readable.
 */
const TILT_CUE_MS = 220

/**
 * Wires the mouse testing behaviour onto the SVG illustration.
 *
 * All state lives in the closure and is rendered as classes on the SVG root,
 * so the visual language stays in CSS.
 *
 * @param {import('jj').JJE} jjSvg - Wrapper around the SVG root.
 * @returns {{ reset: () => void }} A controller with a manual reset.
 */
export function createMouseTest(jjSvg) {
	const directions = { up: false, down: false, left: false, right: false }
	const scroll = { up: false, down: false }
	const tilt = { left: false, right: false }
	const buttons = {
		primary: false,
		wheel: false,
		secondary: false,
		back: false,
		forward: false,
	}

	const directionTimers = new Map()
	const scrollTimers = new Map()
	const tiltTimers = new Map()

	/** Last pointer position, used to derive movement deltas. */
	let lastPoint = null

	const render = () => {
		const classMap = {}
		for (const direction of DIRECTIONS) {
			classMap[CLASS_BY_DIRECTION[direction]] = directions[direction]
		}
		for (const direction of SCROLL_DIRECTIONS) {
			classMap[CLASS_BY_SCROLL[direction]] = scroll[direction]
		}
		for (const direction of TILT_DIRECTIONS) {
			classMap[CLASS_BY_TILT[direction]] = tilt[direction]
		}
		for (const [name, isPressed] of Object.entries(buttons)) {
			classMap[CLASS_BY_BUTTON[name]] = isPressed
		}
		jjSvg.setClasses(classMap)
	}

	const setDirection = (direction, isActive) => {
		if (directions[direction] === isActive) return
		directions[direction] = isActive
		render()
	}

	/** Lights a direction and keeps it lit while movement continues. */
	const showDirection = (direction) => {
		setDirection(direction, true)
		clearTimeout(directionTimers.get(direction))
		directionTimers.set(
			direction,
			setTimeout(() => {
				directionTimers.delete(direction)
				setDirection(direction, false)
			}, DIRECTION_HOLD_MS),
		)
	}

	/** Briefly nudges the wheel for scroll feedback. */
	const showScroll = (direction) => {
		if (!scroll[direction]) {
			scroll[direction] = true
			render()
		}
		clearTimeout(scrollTimers.get(direction))
		scrollTimers.set(
			direction,
			setTimeout(() => {
				scrollTimers.delete(direction)
				scroll[direction] = false
				render()
			}, SCROLL_CUE_MS),
		)
	}

	/** Briefly shifts the wheel sideways for tilt feedback. */
	const showTilt = (direction) => {
		if (!tilt[direction]) {
			tilt[direction] = true
			render()
		}
		clearTimeout(tiltTimers.get(direction))
		tiltTimers.set(
			direction,
			setTimeout(() => {
				tiltTimers.delete(direction)
				tilt[direction] = false
				render()
			}, TILT_CUE_MS),
		)
	}

	const setButton = (buttonIndex, isPressed) => {
		const name = BUTTON_BY_INDEX[buttonIndex]
		if (!name || buttons[name] === isPressed) return
		buttons[name] = isPressed
		render()
	}

	const onPointerMove = (event) => {
		const point = { x: event.clientX, y: event.clientY }
		if (!lastPoint) {
			lastPoint = point
			return
		}
		const deltaX = point.x - lastPoint.x
		const deltaY = point.y - lastPoint.y
		lastPoint = point

		if (Math.abs(deltaX) >= MOVE_THRESHOLD_PX) {
			showDirection(deltaX < 0 ? 'left' : 'right')
		}
		if (Math.abs(deltaY) >= MOVE_THRESHOLD_PX) {
			showDirection(deltaY < 0 ? 'up' : 'down')
		}
	}

	const onPointerLeave = () => {
		lastPoint = null
	}

	const onWheel = (event) => {
		if (event.deltaY) {
			const direction = event.deltaY < 0 ? 'up' : 'down'
			showDirection(direction)
			showScroll(direction)
		}
		if (event.deltaX) {
			// A wheel that tilts side to side reports its movement on X.
			const direction = event.deltaX < 0 ? 'left' : 'right'
			showDirection(direction)
			showTilt(direction)
		}
	}

	const onMouseDown = (event) => {
		const tiltDirection = TILT_BY_BUTTON_INDEX[event.button]
		if (tiltDirection) {
			event.preventDefault()
			showDirection(tiltDirection)
			showTilt(tiltDirection)
			return
		}
		// Suppress middle-click auto-scroll so the wheel button can be tested.
		if (event.button === 1) event.preventDefault()
		setButton(event.button, true)
	}

	const onMouseUp = (event) => {
		setButton(event.button, false)
	}

	const onContextMenu = (event) => {
		// The secondary button is under test here, not a menu.
		event.preventDefault()
	}

	/** Clears every indicator, e.g. when the window loses focus mid-click. */
	const reset = () => {
		for (const timer of directionTimers.values()) clearTimeout(timer)
		directionTimers.clear()
		for (const timer of scrollTimers.values()) clearTimeout(timer)
		scrollTimers.clear()
		for (const timer of tiltTimers.values()) clearTimeout(timer)
		tiltTimers.clear()

		for (const direction of DIRECTIONS) directions[direction] = false
		for (const direction of SCROLL_DIRECTIONS) scroll[direction] = false
		for (const direction of TILT_DIRECTIONS) tilt[direction] = false
		for (const name of Object.keys(buttons)) buttons[name] = false

		lastPoint = null
		render()
	}

	JJET.from(window)
		.on('pointermove', onPointerMove)
		.on('pointerleave', onPointerLeave)
		.on('wheel', onWheel, { passive: true })
		.on('mousedown', onMouseDown)
		.on('mouseup', onMouseUp)
		.on('blur', reset)

	JJD.from(document)
		.on('contextmenu', onContextMenu)
		.on('visibilitychange', () => {
			if (document.visibilityState === 'hidden') reset()
		})

	render()

	return { reset }
}
