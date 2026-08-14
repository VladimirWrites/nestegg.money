/* The landing header on a phone.
 *
 * Six links and a Sign in button do not fit beside the name on a 375px screen — laid out in a
 * row they ran off the edge and took the page's whole width with them. Wrapping them onto a
 * second line fits, but strands the theme toggle on a line of its own, so below the breakpoint
 * they fold into a menu instead.
 *
 * Built here rather than in the markup on purpose: without JavaScript nothing is collapsed and
 * the links stay exactly where they are, wrapped and reachable. The class this adds is what
 * turns the collapse on, so a reader who never runs this file never loses a link to it.
 */
(function () {
  var nav = document.querySelector(".lp-nav");
  var links = nav && nav.querySelector(".lp-navlinks");
  if (!nav || !links) return;

  if (!links.id) links.id = "lpNavLinks";

  var btn = document.createElement("button");
  btn.type = "button";
  btn.className = "lp-burger";
  btn.setAttribute("aria-label", nav.getAttribute("data-menu-label") || "Menu");
  btn.setAttribute("aria-controls", links.id);
  btn.setAttribute("aria-expanded", "false");
  // Three lines, drawn rather than typed: an SVG scales with the button and needs no font.
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></svg>';
  nav.appendChild(btn);
  nav.classList.add("lp-nav-js");

  function setOpen(open) {
    nav.classList.toggle("is-open", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  }
  var isOpen = function () { return nav.classList.contains("is-open"); };

  btn.addEventListener("click", function (e) {
    e.stopPropagation();          // the document listener below would close it again
    setOpen(!isOpen());
  });

  // Anywhere else on the page, Escape, or following a link: all of them mean "done here".
  document.addEventListener("click", function (e) {
    if (isOpen() && !nav.contains(e.target)) setOpen(false);
  });
  links.addEventListener("click", function (e) {
    if (e.target.closest("a")) setOpen(false);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && isOpen()) { setOpen(false); btn.focus(); }
  });
  // Turned to landscape or resized past the breakpoint, the panel is not a panel any more.
  window.addEventListener("resize", function () {
    if (isOpen() && getComputedStyle(btn).display === "none") setOpen(false);
  });
})();
