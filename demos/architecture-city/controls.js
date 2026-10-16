/** The control bar: layout on the left, rendering style on the right, state carried in the URL. */
import { LAYOUTS } from "./layouts.js";

const params = new URLSearchParams(location.search);

export function activeLayout() {
  const wanted = params.get("layout");
  return LAYOUTS.includes(wanted) ? wanted : "spiral";
}

export function wireControls(onLayout) {
  const current = activeLayout();
  const press = (layout) => {
    for (const l of LAYOUTS) {
      document.getElementById(`l-${l}`)?.setAttribute("aria-pressed", String(l === layout));
    }
  };
  press(current);
  for (const l of LAYOUTS) {
    document.getElementById(`l-${l}`)?.addEventListener("click", () => {
      press(l);
      onLayout(l);
    });
  }
  // Switching style keeps the chosen layout: two controls, but a page load between them.
  for (const a of document.querySelectorAll("#controls .styles a")) {
    const url = new URL(a.getAttribute("href"), location.href);
    url.searchParams.set("layout", current);
    const file = url.pathname.split("/").pop();
    a.setAttribute("href", `./${file}${url.search}`);
    a.setAttribute("aria-current", a.dataset.style === document.body.dataset.style ? "page" : "false");
    if (a.dataset.style === document.body.dataset.style) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
  return current;
}
