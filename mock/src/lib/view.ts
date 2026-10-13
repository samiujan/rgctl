import { getRouteApi } from "@tanstack/react-router";
import { ROOMS, type LensId, type RoomId } from "./focus";
import type { ViewSearch } from "./router";

/**
 * Reading and writing the view state, backed by the router.
 *
 * Deliberately a separate module from `router.tsx`: the route tree needs to reference the shell
 * component, the shell needs `useView`, and putting both in one file would be a circular import.
 * `getRouteApi` resolves by route id, so this needs no reference to the router instance.
 */
const api = getRouteApi("/$roomId");

/** True when the path segment is a room we know — an unknown one falls back to orientation. */
function toRoom(id: string | undefined): RoomId {
  return (ROOMS.some((r) => r.id === id) ? id : "repo") as RoomId;
}

export function useView() {
  const params = api.useParams();
  const search = api.useSearch();
  const navigate = api.useNavigate();

  const room = toRoom(params.roomId);

  /** Preserve search when only the room changes — the subject and lens are orthogonal to it. */
  const goRoom = (roomId: RoomId) =>
    void navigate({ to: "/$roomId", params: { roomId }, search: (prev) => prev });

  const patch = (next: Partial<ViewSearch>) =>
    void navigate({ to: "/$roomId", params: { roomId: room }, search: (prev) => ({ ...prev, ...next }) });

  return {
    room,
    lens: search.lens ?? ("spine" as LensId),
    focus: search.focus ?? null,
    palette: search.palette === true,
    setRoom: goRoom,
    setLens: (lens: LensId) => patch({ lens }),
    /** Setting focus never changes room or lens — the subject and how you look at it are independent. */
    setFocus: (focus: string | null) => patch({ focus: focus ?? undefined }),
    setPalette: (palette: boolean) => patch({ palette: palette ? true : undefined }),
    /** Carry the subject somewhere else: the point of a portable, identity-keyed Focus. */
    carryTo: goRoom,
  };
}
