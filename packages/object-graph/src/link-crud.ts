import type {
  CreateLinkInput,
  Link,
  LinkFilter,
  ObjectReference,
  ObjectUid,
  UpdateLinkInput,
} from './types.js';

/**
 * Repository interface for Link CRUD operations.
 * Runtime implementations (SQLite, in-memory, etc.) will fulfill this contract.
 */
export interface LinkRepository {
  create(link: CreateLinkInput): Promise<Link>;
  update(linkId: string, updates: UpdateLinkInput): Promise<Link>;
  reject(linkId: string, reason: string): Promise<Link>;
  archive(linkId: string): Promise<Link>;
  getById(linkId: string): Promise<Link | null>;
  list(filter: LinkFilter): Promise<Link[]>;
  listBacklinks(targetUid: ObjectUid, filter?: LinkFilter): Promise<Link[]>;
  listOutlinks(sourceUid: ObjectUid, filter?: LinkFilter): Promise<Link[]>;
  listNeighbors(objectUid: ObjectUid, hops?: number): Promise<ObjectReference[]>;
}
