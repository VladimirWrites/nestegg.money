/* The screenshot rail on the landing page.
 *
 * It already scrolls with a finger, a trackpad, a scrollbar and the keyboard. This adds the two
 * things a mouse needs and none of those give it: the arrows, and the ability to pull the row.
 * Everything here is an addition to something that already works, so if it never runs the rail
 * is still a rail.
 */
(function () {
  var rail = document.querySelector(".lp-shots-rail");
  if (!rail) return;

  // One frame plus the gap — how far an arrow moves. Falls back to most of a screenful.
  var step = function () {
    var c = rail.querySelector(".lp-shot");
    return c ? c.getBoundingClientRect().width + 20 : rail.clientWidth * 0.8;
  };

  var still = matchMedia("(prefers-reduced-motion: reduce)");
  Array.prototype.forEach.call(document.querySelectorAll(".lp-shots-arrow"), function (b) {
    b.addEventListener("click", function () {
      rail.scrollBy({ left: step() * Number(b.dataset.scroll), behavior: still.matches ? "auto" : "smooth" });
    });
  });

  /* Pulling the row.
   *
   * Mouse only: a finger already scrolls it, and taking over touch would break that. The drag
   * does not begin until the pointer has actually moved, so a plain click still reaches whatever
   * is underneath. */
  var SLOP = 6;
  var startX = 0, startLeft = 0, pressed = false, dragged = false;

  rail.addEventListener("pointerdown", function (e) {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    pressed = true;
    dragged = false;
    startX = e.clientX;
    startLeft = rail.scrollLeft;
  });

  rail.addEventListener("pointermove", function (e) {
    if (!pressed) return;
    var dx = e.clientX - startX;
    if (!dragged && Math.abs(dx) < SLOP) return;
    if (!dragged) {
      dragged = true;
      rail.classList.add("is-dragging");
      // Capture keeps the drag alive past the edge of the rail. Guarded because it throws on a
      // pointer the browser no longer considers active, and losing the capture is better than
      // losing the rest of this handler — which is the part that actually scrolls.
      try { rail.setPointerCapture(e.pointerId); } catch (err) {}
    }
    rail.scrollLeft = startLeft - dx;
    e.preventDefault();
  });

  var release = function (e) {
    if (!pressed) return;
    pressed = false;
    rail.classList.remove("is-dragging");
    if (e && e.pointerId != null) {
      try { rail.releasePointerCapture(e.pointerId); } catch (err) {}
    }
  };
  rail.addEventListener("pointerup", release);
  rail.addEventListener("pointercancel", release);

  // The click that ends a drag is swallowed, or letting go over a frame would count as pressing it.
  rail.addEventListener("click", function (e) {
    if (dragged) { e.preventDefault(); e.stopPropagation(); dragged = false; }
  }, true);
})();
