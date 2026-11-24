const carousel = document.querySelector(".image-carousel");
const track = document.querySelector(".image-carousel-track");
const images = track ? Array.from(track.querySelectorAll("img")) : [];

if (carousel && track && images.length > 0) {
  let rotation = 0;
  let dragStartX = 0;
  let dragStartRotation = 0;
  let isDragging = false;
  let lastFrameTime = performance.now();
  let carouselSize = 0;

  const updateSize = () => {
    const cardWidth = images[0].getBoundingClientRect().width;
    const halfTurnSpacing = cardWidth * 1.08;
    const countBasedRadius = halfTurnSpacing / (2 * Math.sin(Math.PI / images.length));
    carouselSize = Math.max(cardWidth * 1.2, Math.min(countBasedRadius, window.innerWidth * 0.42));
  };

  const updateCarousel = () => {
    const radiusX = carouselSize;
    const radiusZ = Math.max(100, Math.min(carouselSize * 0.22, 180));
    const angleStep = 360 / images.length;

    images.forEach((image, index) => {
      const angle = index * angleStep + rotation;
      const angleInRadians = angle * Math.PI / 180;
      const isOnFrontHalf = Math.cos(angleInRadians) > -0.25;
      const x = Math.sin(angleInRadians) * radiusX;
      const z = Math.cos(angleInRadians) * radiusZ;
      const scale = 0.82 + Math.max(0, Math.cos(angleInRadians)) * 0.18;
      const fade = Math.min(1, Math.max(0, (0.25 + Math.cos(angleInRadians)) * 3));

      image.style.transform = `translate(-50%, -50%) translate3d(${x}px, 0, ${z}px) scale(${scale})`;
      image.style.filter = `brightness(${0.68 + Math.max(0, Math.cos(angleInRadians)) * 0.32})`;
      image.style.opacity = isOnFrontHalf ? String(fade) : "0";
      image.style.pointerEvents = isOnFrontHalf ? "auto" : "none";
      image.style.zIndex = String(Math.round(Math.max(0, Math.cos(angleInRadians)) * 100));
    });
  };

  const animate = (time) => {
    const elapsed = time - lastFrameTime;
    lastFrameTime = time;

    if (!isDragging && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      rotation -= elapsed * 0.018;
      updateCarousel();
    }

    requestAnimationFrame(animate);
  };

  carousel.addEventListener("pointerdown", (event) => {
    isDragging = true;
    dragStartX = event.clientX;
    dragStartRotation = rotation;
    carousel.classList.add("is-dragging");
    carousel.setPointerCapture(event.pointerId);
  });

  carousel.addEventListener("pointermove", (event) => {
    if (!isDragging) {
      return;
    }

    rotation = dragStartRotation + (event.clientX - dragStartX) * 0.35;
    updateCarousel();
  });

  const stopDragging = (event) => {
    if (!isDragging) {
      return;
    }

    isDragging = false;
    carousel.classList.remove("is-dragging");

    if (carousel.hasPointerCapture(event.pointerId)) {
      carousel.releasePointerCapture(event.pointerId);
    }
  };

  carousel.addEventListener("pointerup", stopDragging);
  carousel.addEventListener("pointercancel", stopDragging);
  window.addEventListener("resize", () => {
    updateSize();
    updateCarousel();
  });

  updateSize();
  updateCarousel();
  requestAnimationFrame(animate);
}