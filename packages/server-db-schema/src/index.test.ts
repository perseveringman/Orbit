import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  SERVER_DATA_POLICY,
  SERVER_METADATA_TABLES,
  listServerMetadataTableNames,
} from './index.ts';

describe('server-db-schema', () => {
  it('导出仅包含服务端元数据的表结构草图', () => {
    assert.equal(SERVER_DATA_POLICY.plaintextHandling, 'forbidden');
    assert.match(SERVER_DATA_POLICY.description, /不处理用户明文/);

    assert.deepEqual(listServerMetadataTableNames(), [
      'server_accounts',
      'server_devices',
      'server_sync_sessions',
      'server_blobs',
      'server_gdpr_requests',
      'server_notification_outbox',
    ]);

    for (const table of Object.values(SERVER_METADATA_TABLES)) {
      assert.equal(table.plaintextAllowed, false);
      for (const column of Object.values(table.columns)) {
        assert.equal(column.plaintextAllowed, false);
      }
    }
  });
});
