import type { HydratedObject, ObjectUid } from './types.js';

/**
 * Interface for resolving bare UIDs into fully-typed, hydrated objects.
 * Implementations will look up the object_index table and join the
 * canonical type table to build the full payload.
 */
export interface ObjectHydrator {
  hydrate(uid: ObjectUid): Promise<HydratedObject | null>;
  hydrateMany(uids: ObjectUid[]): Promise<Map<ObjectUid, HydratedObject>>;
}
