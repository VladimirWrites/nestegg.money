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

  /* Which set of pictures to show.
   *
   * The frames come in a light and a dark version, and the markup picks between them with
   * prefers-color-scheme — right for a reader who never touches the toggle, and wrong the moment
   * one does, since a page turned light by the button is still a dark page as far as that query
   * is concerned. So an explicit choice overrides the media on each source: the wanted one is
   * given its own condition, the other is given one that cannot match. With no choice stored,
   * the original media strings are put back and the device decides again.
   *
   * Read from local storage rather than from the document, because the page marks light with an
   * attribute and dark by removing it — which makes an explicit dark indistinguishable from no
   * choice at all. The button writes the answer down; this reads it. */
  var sources = rail.querySelectorAll("source[data-shot]");
  Array.prototype.forEach.call(sources, function (s) { s.dataset.auto = s.media; });

  var stored = function () { try { return localStorage.getItem("nw_theme"); } catch (e) { return null; } };

  var applyTheme = function () {
    var choice = stored();
    Array.prototype.forEach.call(sources, function (s) {
      if (choice !== "light" && choice !== "dark") { s.media = s.dataset.auto; return; }
      var wanted = (s.dataset.shot === "light") === (choice === "light");
      s.media = wanted ? (s.dataset.base || "all") : "not all";
    });
  };
  applyTheme();

  // The toggle writes to storage in its own handler; this runs after it on the same click.
  var themeBtn = document.getElementById("lpTheme");
  if (themeBtn) themeBtn.addEventListener("click", function () { setTimeout(applyTheme, 0); });

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
