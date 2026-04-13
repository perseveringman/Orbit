import type { DatabasePort } from '@orbit/platform-contracts';
import type {
  ObjectRepository,
  LinkRepository,
  EventRepository,
  SearchRepository,
  WriteTransactionFactory,
} from '@orbit/data-protocol';
import { SqliteObjectRepository } from './object-repository.js';
import { SqliteLinkRepository } from './link-repository.js';
import { SqliteEventRepository } from './event-repository.js';
import { SqliteSearchRepository } from './search-repository.js';
import { SqliteWriteTransactionFactory } from './write-transaction.js';

export interface OrbitRepositories {
  objects: ObjectRepository;
  links: LinkRepository;
  events: EventRepository;
  search: SearchRepository;
  writeTransactions: WriteTransactionFactory;
}

export function createRepositories(db: DatabasePort): OrbitRepositories {
  return {
    objects: new SqliteObjectRepository(db),
    links: new SqliteLinkRepository(db),
    events: new SqliteEventRepository(db),
    search: new SqliteSearchRepository(db),
    writeTransactions: new SqliteWriteTransactionFactory(db),
  };
}
