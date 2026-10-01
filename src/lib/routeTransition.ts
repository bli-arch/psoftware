import { onNavigate } from "$app/navigation";
import { animationTime } from "$lib/uiPreferences";

type RouteTransitionMotion = {
    direction: -1 | 1;
    fade?: boolean;
    slide?: boolean;
};

type RouteTransitionOptions = {
    useNativeViewTransition?: boolean;
};

type ViewTransition = {
    finished: Promise<void>;
    skipTransition: () => void;
};

type ViewTransitionDocument = Document & {
    startViewTransition?: (update: () => Promise<void> | void) => ViewTransition;
};

let activeTransition: ViewTransition | null = null;
let activeCleanup: (() => void) | null = null;
let activeAnimation: Animation | null = null;
let activeObserver: MutationObserver | null = null;
let transitionId = 0;

function fallbackRouteTransition(
    container: HTMLElement,
    motion: RouteTransitionMotion,
    duration: number,
    navigationComplete: Promise<void>,
) {
    const id = ++transitionId;
    const halfDuration = duration / 2;
    const fadedOpacity = motion.fade ? 0 : 1;
    const exitX = motion.slide === false ? 0 : motion.direction * -16;
    const enterX = motion.slide === false ? 0 : motion.direction * 24;
    const outgoingElements = Array.from(container.children).filter(
        (element): element is HTMLElement => element instanceof HTMLElement,
    );
    const outgoingOptions: KeyframeAnimationOptions = {
        duration: halfDuration,
        easing: "ease-in-out",
        fill: "both",
    };
    const incomingOptions: KeyframeAnimationOptions = {
        duration: halfDuration,
        easing: "ease-in-out",
        fill: "both",
    };
    const outgoing = container.animate([
        { opacity: 1, transform: "translateX(0)" },
        { opacity: fadedOpacity, transform: `translateX(${exitX}px)` },
    ], outgoingOptions);
    activeAnimation = outgoing;

    return new Promise<void>((resumeNavigation) => {
        let observer: MutationObserver | null = null;
        let incomingStarted = false;

        const disconnectObserver = () => {
            observer?.disconnect();
            if (activeObserver === observer) activeObserver = null;
            observer = null;
        };
        const startIncoming = () => {
            if (incomingStarted || id !== transitionId) return;
            incomingStarted = true;
            disconnectObserver();
            for (const element of outgoingElements) {
                if (element.parentElement === container) element.style.display = "none";
            }
            outgoing.cancel();
            const incoming = container.animate([
                { opacity: fadedOpacity, transform: `translateX(${enterX}px)` },
                { opacity: 1, transform: "translateX(0)" },
            ], incomingOptions);
            activeAnimation = incoming;
            void incoming.finished.then(() => {
                incoming.cancel();
                if (id === transitionId) activeAnimation = null;
            }, () => {
                if (id === transitionId) activeAnimation = null;
            });
        };

        void outgoing.finished.then(() => {
            if (id !== transitionId) {
                resumeNavigation();
                return;
            }
            observer = new MutationObserver(startIncoming);
            observer.observe(container, { childList: true });
            activeObserver = observer;
            resumeNavigation();
            void navigationComplete.then(startIncoming, () => {
                disconnectObserver();
                outgoing.cancel();
                if (id === transitionId) activeAnimation = null;
            });
        }, () => {
            disconnectObserver();
            if (id === transitionId) activeAnimation = null;
            resumeNavigation();
        });
    });
}

export function setupRouteTransition(
    getContainer: () => HTMLElement | null,
    motionFor: (from: URL, to: URL) => RouteTransitionMotion | null,
    options: RouteTransitionOptions = {},
) {
    onNavigate((navigation) => {
        const from = navigation.from?.url;
        const to = navigation.to?.url;
        if (!from || !to) return;

        const motion = motionFor(from, to);
        const duration = animationTime(300);
        const container = getContainer();
        const viewTransitionDocument = document as ViewTransitionDocument;
        const startViewTransition = viewTransitionDocument.startViewTransition;
        if (!motion || duration <= 0 || !container) return;

        activeTransition?.skipTransition();
        activeCleanup?.();
        activeAnimation?.cancel();
        activeAnimation = null;
        activeObserver?.disconnect();
        activeObserver = null;
        if (!startViewTransition || options.useNativeViewTransition === false) {
            return fallbackRouteTransition(container, motion, duration, navigation.complete);
        }

        const id = ++transitionId;
        const root = document.documentElement;
        const previousName = container.style.getPropertyValue("view-transition-name");
        const bounds = container.getBoundingClientRect();
        container.style.setProperty("view-transition-name", "psoft-route-content");
        root.classList.add("psoft-route-transition");
        root.style.setProperty("--psoft-route-duration", `${duration}ms`);
        root.style.setProperty("--psoft-route-enter-x", motion.slide === false ? "0px" : `${motion.direction * 24}px`);
        root.style.setProperty("--psoft-route-exit-x", motion.slide === false ? "0px" : `${motion.direction * -16}px`);
        root.style.setProperty("--psoft-route-faded-opacity", motion.fade ? "0" : "1");
        root.style.setProperty("--psoft-route-clip-top", `${Math.max(0, bounds.top)}px`);
        root.style.setProperty("--psoft-route-clip-right", `${Math.max(0, window.innerWidth - bounds.right)}px`);
        root.style.setProperty("--psoft-route-clip-bottom", `${Math.max(0, window.innerHeight - bounds.bottom)}px`);
        root.style.setProperty("--psoft-route-clip-left", `${Math.max(0, bounds.left)}px`);

        const cleanup = () => {
            if (id !== transitionId) return;
            if (previousName) container.style.setProperty("view-transition-name", previousName);
            else container.style.removeProperty("view-transition-name");
            root.classList.remove("psoft-route-transition");
            root.style.removeProperty("--psoft-route-duration");
            root.style.removeProperty("--psoft-route-enter-x");
            root.style.removeProperty("--psoft-route-exit-x");
            root.style.removeProperty("--psoft-route-faded-opacity");
            root.style.removeProperty("--psoft-route-clip-top");
            root.style.removeProperty("--psoft-route-clip-right");
            root.style.removeProperty("--psoft-route-clip-bottom");
            root.style.removeProperty("--psoft-route-clip-left");
            activeTransition = null;
            activeCleanup = null;
        };
        activeCleanup = cleanup;

        return new Promise<void>((resumeNavigation) => {
            try {
                const transition = startViewTransition.call(viewTransitionDocument, async () => {
                    resumeNavigation();
                    await navigation.complete;
                });
                activeTransition = transition;
                void transition.finished.then(cleanup, cleanup);
            } catch {
                cleanup();
                resumeNavigation();
            }
        });
    });
}
