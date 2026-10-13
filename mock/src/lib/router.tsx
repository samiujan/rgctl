import { Outlet, createRootRoute, createRoute, createRouter, redirect } from "@tanstack/react-router";
import { LENSES, ROOMS, type LensId } from "./focus";
import { App } from "../App";

/**
 * Routing, on TanStack Router.
 *
 * URL shape:
 *
 *   /understand?lens=cfgpddg&focus=<stable-key>
 *   /architecture
 *   /review?focus=<stable-key>&palette=1
 *
 * A **room is a path segment** and a **lens is a search param**, which is the distinction the IA
 * rests on: rooms are destinations you navigate to, lenses are a control over the current subject.
 * Encoding that in the URL means the two cannot be confused by the router either.
 *
 * `validateSearch` is where the Focus key earns its keep. Search params arrive as untrusted strings,
 * so an unknown room, an unknown lens, or a malformed focus is dropped at the boundary and the app
 * gets a typed, total value. Without that, a typo'd URL silently renders an empty room.
 */

export interface ViewSearch {
  /** Omitted when it is the default, so a shared link carries only what differs. */
  lens?: LensId;
  /** `StableNodeKey` of the current subject — `BLAKE3(path, name, type)` in the real product. */
  focus?: string;
  palette?: true;
}

/** Root renders only an outlet; the shell lives on the room route so it has the room in scope. */
const rootRoute = createRootRoute({ component: () => <Outlet /> });

/** Un-parameterised entry: send `/` to the orientation room rather than rendering an empty shell. */
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/$roomId", params: { roomId: "repo" }, replace: true });
  },
});

export const roomRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "$roomId",
  component: App,
  /**
   * An unknown room redirects rather than rendering a fallback, so the URL never claims to be
   * somewhere the app is not. That matters because every view state is meant to be a shareable
   * link: a `/nonsense` URL that quietly renders orientation would look like it worked.
   */
  beforeLoad: ({ params }) => {
    if (!ROOMS.some((r) => r.id === params.roomId)) {
      throw redirect({ to: "/$roomId", params: { roomId: "repo" }, replace: true });
    }
  },
  validateSearch: (search: Record<string, unknown>): ViewSearch => {
    const lens = LENSES.some((l) => l.id === search.lens) ? (search.lens as LensId) : undefined;
    const focus = typeof search.focus === "string" && search.focus.length > 0 ? search.focus : undefined;
    const palette = search.palette === true || search.palette === "1" ? (true as const) : undefined;
    return { lens, focus, palette };
  },
});

const routeTree = rootRoute.addChildren([indexRoute, roomRoute]);

export const router = createRouter({ routeTree, defaultPreload: false });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
