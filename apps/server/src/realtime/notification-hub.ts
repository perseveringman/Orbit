import type { ServerCoreOrchestrator } from '@orbit/server-core';
import type { ServerInfraBundle } from '@orbit/server-infra';

import type { ServerHostDescriptor } from '../shared/host.js';

export interface NotificationHubDependencies {
  host: ServerHostDescriptor;
  core: ServerCoreOrchestrator;
  infra: ServerInfraBundle;
}

export interface OrbitNotificationEvent {
  topic: string;
  payload: Record<string, unknown>;
  emittedAt: string;
}

export interface WebSocketConnection {
  id: string;
  accountId: string;
  deviceId: string;
  topics: Set<string>;
  send: (data: string) => void;
}

export interface SseConnection {
  id: string;
  accountId: string;
  deviceId: string;
  topics: Set<string>;
  send: (event: string, data: string) => void;
}

export interface ApnsRegistration {
  deviceId: string;
  accountId: string;
  apnsToken: string;
  registeredAt: string;
}

export interface OrbitNotificationHub {
  publish: (topic: string, payload: Record<string, unknown>) => OrbitNotificationEvent;
  snapshot: () => OrbitNotificationEvent[];
  describe: () => {
    mode: string;
    service: string;
    zeroKnowledge: boolean;
    wsConnections: number;
    sseConnections: number;
    apnsRegistrations: number;
    topics: string[];
  };
  subscribe: (topic: string, connectionId: string) => void;
  unsubscribe: (topic: string, connectionId: string) => void;
  registerWebSocket: (conn: WebSocketConnection) => void;
  removeWebSocket: (connectionId: string) => void;
  registerSse: (conn: SseConnection) => void;
  removeSse: (connectionId: string) => void;
  registerApnsToken: (registration: ApnsRegistration) => void;
  removeApnsToken: (deviceId: string) => void;
  listTopics: () => string[];
}

export const createNotificationHub = ({ host }: NotificationHubDependencies): OrbitNotificationHub => {
  const events: OrbitNotificationEvent[] = [];
  const wsConnections = new Map<string, WebSocketConnection>();
  const sseConnections = new Map<string, SseConnection>();
  const apnsRegistrations = new Map<string, ApnsRegistration>();
  const topicSubscribers = new Map<string, Set<string>>();

  function getOrCreateTopicSet(topic: string): Set<string> {
    let subs = topicSubscribers.get(topic);
    if (!subs) {
      subs = new Set();
      topicSubscribers.set(topic, subs);
    }
    return subs;
  }

  return {
    publish: (topic, payload) => {
      const event: OrbitNotificationEvent = {
        topic,
        payload,
        emittedAt: new Date().toISOString(),
      };

      events.unshift(event);
      events.splice(100);

      const serialized = JSON.stringify({ topic, payload, emittedAt: event.emittedAt });

      // Fan out to WebSocket subscribers
      const subscribers = topicSubscribers.get(topic);
      if (subscribers) {
        for (const connId of subscribers) {
          const ws = wsConnections.get(connId);
          if (ws) {
            try { ws.send(serialized); } catch { /* connection closed */ }
          }
          const sse = sseConnections.get(connId);
          if (sse) {
            try { sse.send(topic, serialized); } catch { /* connection closed */ }
          }
        }
      }

      return event;
    },

    snapshot: () => [...events],

    describe: () => ({
      mode: host.realtime,
      service: host.name,
      zeroKnowledge: host.zeroKnowledge,
      wsConnections: wsConnections.size,
      sseConnections: sseConnections.size,
      apnsRegistrations: apnsRegistrations.size,
      topics: [...topicSubscribers.keys()],
    }),

    subscribe: (topic, connectionId) => {
      getOrCreateTopicSet(topic).add(connectionId);
    },

    unsubscribe: (topic, connectionId) => {
      topicSubscribers.get(topic)?.delete(connectionId);
    },

    registerWebSocket: (conn) => {
      wsConnections.set(conn.id, conn);
      for (const topic of conn.topics) {
        getOrCreateTopicSet(topic).add(conn.id);
      }
    },

    removeWebSocket: (connectionId) => {
      const conn = wsConnections.get(connectionId);
      if (conn) {
        for (const topic of conn.topics) {
          topicSubscribers.get(topic)?.delete(connectionId);
        }
        wsConnections.delete(connectionId);
      }
    },

    registerSse: (conn) => {
      sseConnections.set(conn.id, conn);
      for (const topic of conn.topics) {
        getOrCreateTopicSet(topic).add(conn.id);
      }
    },

    removeSse: (connectionId) => {
      const conn = sseConnections.get(connectionId);
      if (conn) {
        for (const topic of conn.topics) {
          topicSubscribers.get(topic)?.delete(connectionId);
        }
        sseConnections.delete(connectionId);
      }
    },

    registerApnsToken: (registration) => {
      apnsRegistrations.set(registration.deviceId, registration);
    },

    removeApnsToken: (deviceId) => {
      apnsRegistrations.delete(deviceId);
    },

    listTopics: () => [...topicSubscribers.keys()],
  };
};
