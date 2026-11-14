/* A small, progressively enhanced viewer for the homepage's cell image. */
(() => {
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  document.querySelectorAll('[data-image-viewer]').forEach((viewer) => {
    const viewport = viewer.querySelector('[data-image-viewport]');
    const image = viewport?.querySelector('img');
    const controls = viewer.querySelector('[data-image-controls]');
    const zoomIn = viewer.querySelector('[data-zoom-in]');
    const zoomOut = viewer.querySelector('[data-zoom-out]');
    const resetButton = viewer.querySelector('[data-zoom-reset]');
    const level = viewer.querySelector('[data-zoom-level]');
    if (!image || !controls || !zoomIn || !zoomOut || !resetButton || !level) return;

    const minScale = 1;
    const maxScale = 4;
    const pointers = new Map();
    let scale = 1;
    let x = 0;
    let y = 0;
    let width = 0;
    let height = 0;
    let imageWidth = 0;
    let imageHeight = 0;
    let initialX = 0;
    let initialY = 0;
    let ready = false;

    function render() {
      const limitX = Math.max(0, (imageWidth * scale - width) / 2);
      const limitY = Math.max(0, (imageHeight * scale - height) / 2);
      x = clamp(x, -limitX, limitX);
      y = clamp(y, -limitY, limitY);
      image.style.transform = `translate(${(width - imageWidth * scale) / 2 + x}px, ${(height - imageHeight * scale) / 2 + y}px) scale(${scale})`;
      viewport.classList.toggle('is-zoomed', scale > minScale);
      viewport.classList.toggle('is-dragging', pointers.size > 0);
      zoomIn.disabled = scale >= maxScale;
      zoomOut.disabled = scale <= minScale;
      const text = `${Math.round(scale * 100)}%`;
      if (level.textContent !== text) level.textContent = text;
    }

    function releasePointers() {
      for (const id of pointers.keys()) {
        if (viewport.hasPointerCapture(id)) viewport.releasePointerCapture(id);
      }
      pointers.clear();
    }

    function reset() {
      releasePointers();
      scale = minScale;
      x = initialX;
      y = initialY;
      render();
    }

    function layout() {
      const nextWidth = viewport.clientWidth;
      const nextHeight = viewport.clientHeight;
      if (!nextWidth || !nextHeight || !image.naturalWidth || !image.naturalHeight) return;
      if (ready && nextWidth === width && nextHeight === height) return;
      width = nextWidth;
      height = nextHeight;
      const cover = Math.max(width / image.naturalWidth, height / image.naturalHeight);
      imageWidth = image.naturalWidth * cover;
      imageHeight = image.naturalHeight * cover;
      // Keep the static image's percentage-based object-position on reset.
      const position = getComputedStyle(image).objectPosition.split(' ');
      const percentage = (part) => part?.endsWith('%') ? parseFloat(part) / 100 : .5;
      initialX = (width - imageWidth) * (percentage(position[0]) - .5);
      initialY = (height - imageHeight) * (percentage(position[1]) - .5);
      image.style.width = `${imageWidth}px`;
      image.style.height = `${imageHeight}px`;
      image.draggable = false;
      viewport.tabIndex = 0;
      viewer.classList.add('image-viewer-ready');
      controls.hidden = false;
      const help = viewer.querySelector('[data-image-help]');
      if (help) help.hidden = false;
      ready = true;
      reset();
    }

    function zoomTo(nextScale) {
      if (!ready) return;
      const bounded = clamp(nextScale, minScale, maxScale);
      const ratio = bounded / scale;
      x *= ratio;
      y *= ratio;
      scale = bounded;
      if (scale === minScale) {
        x = initialX;
        y = initialY;
      }
      render();
    }

    zoomIn.addEventListener('click', () => zoomTo(scale + .5));
    zoomOut.addEventListener('click', () => zoomTo(scale - .5));
    resetButton.addEventListener('click', reset);

    viewport.addEventListener('keydown', (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === '+' || event.key === '=') zoomTo(scale + .5);
      else if (event.key === '-' || event.key === '_') zoomTo(scale - .5);
      else if (event.key === '0' || event.key === 'Home' || event.key === 'Escape') reset();
      else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
        && (scale > minScale || (imageWidth > width && ['ArrowLeft', 'ArrowRight'].includes(event.key)))) {
        const distance = event.shiftKey ? 80 : 40;
        if (event.key === 'ArrowLeft') x += distance;
        if (event.key === 'ArrowRight') x -= distance;
        if (event.key === 'ArrowUp') y += distance;
        if (event.key === 'ArrowDown') y -= distance;
        render();
      } else return;
      event.preventDefault();
    });

    viewport.addEventListener('pointerdown', (event) => {
      // At 100%, touch gestures remain ordinary page scrolling and page zoom.
      if (!ready || (scale <= minScale && event.pointerType !== 'mouse') || event.button !== 0) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      viewport.setPointerCapture(event.pointerId);
      event.preventDefault();
      render();
    });

    viewport.addEventListener('pointermove', (event) => {
      if (!pointers.has(event.pointerId)) return;
      const before = [...pointers.values()];
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const after = [...pointers.values()];
      if (before.length === 1) {
        x += after[0].x - before[0].x;
        y += after[0].y - before[0].y;
      } else {
        const distance = (points) => Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
        const previousDistance = distance(before);
        if (previousDistance > 0) {
          const bounds = viewport.getBoundingClientRect();
          const midpoint = (points) => ({
            x: (points[0].x + points[1].x) / 2 - bounds.left - width / 2,
            y: (points[0].y + points[1].y) / 2 - bounds.top - height / 2,
          });
          const previous = midpoint(before);
          const current = midpoint(after);
          const nextScale = clamp(scale * distance(after) / previousDistance, minScale, maxScale);
          const ratio = nextScale / scale;
          x = current.x - (previous.x - x) * ratio;
          y = current.y - (previous.y - y) * ratio;
          scale = nextScale;
        }
      }
      render();
    });

    function finishPointer(event) {
      pointers.delete(event.pointerId);
      if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
      render();
    }
    viewport.addEventListener('pointerup', finishPointer);
    viewport.addEventListener('lostpointercapture', finishPointer);
    viewport.addEventListener('pointercancel', () => {
      releasePointers();
      render();
    });

    if ('ResizeObserver' in window) new ResizeObserver(layout).observe(viewport);
    else window.addEventListener('resize', layout);
    image.addEventListener('load', layout);
    layout();
  });
})();
