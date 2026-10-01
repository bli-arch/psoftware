export function observeVisiblePage(
    viewport: HTMLElement,
    pages: ReadonlyMap<HTMLElement, number>,
    onVisiblePage?: (page: number) => void,
) {
    const firstPage = pages.values().next().value;
    if (!onVisiblePage || firstPage === undefined) return () => undefined;

    let currentPage = firstPage;
    let animationFrame: number | null = null;
    const visible = new Set<HTMLElement>();
    onVisiblePage(firstPage);

    const update = () => {
        animationFrame = null;
        const viewportRect = viewport.getBoundingClientRect();
        const viewportCenter = (viewportRect.top + viewportRect.bottom) / 2;
        let bestPage = currentPage;
        let bestArea = 0;
        let bestDistance = Number.POSITIVE_INFINITY;

        for (const element of visible) {
            const rect = element.getBoundingClientRect();
            const width = Math.max(0, Math.min(rect.right, viewportRect.right) - Math.max(rect.left, viewportRect.left));
            const height = Math.max(0, Math.min(rect.bottom, viewportRect.bottom) - Math.max(rect.top, viewportRect.top));
            const area = width * height;
            const distance = Math.abs((rect.top + rect.bottom) / 2 - viewportCenter);
            if (area > bestArea || (area === bestArea && distance < bestDistance)) {
                bestPage = pages.get(element) ?? bestPage;
                bestArea = area;
                bestDistance = distance;
            }
        }

        if (bestArea > 0 && bestPage !== currentPage) {
            currentPage = bestPage;
            onVisiblePage(bestPage);
        }
    };

    const scheduleUpdate = () => {
        if (animationFrame === null) animationFrame = requestAnimationFrame(update);
    };
    const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (entry.isIntersecting) visible.add(entry.target as HTMLElement);
            else visible.delete(entry.target as HTMLElement);
        }
        scheduleUpdate();
    }, { root: viewport });
    const resizeObserver = new ResizeObserver(scheduleUpdate);
    resizeObserver.observe(viewport);
    for (const page of pages.keys()) {
        observer.observe(page);
        resizeObserver.observe(page);
    }
    viewport.addEventListener("scroll", scheduleUpdate, { passive: true });

    return () => {
        observer.disconnect();
        resizeObserver.disconnect();
        viewport.removeEventListener("scroll", scheduleUpdate);
        if (animationFrame !== null) cancelAnimationFrame(animationFrame);
    };
}
