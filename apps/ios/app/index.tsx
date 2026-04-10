import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { ProjectRecord, TaskRecord } from '@orbit/domain';
import { createMobileFeatureModule } from '@orbit/feature-mobile';
import { createIosRuntimeAdapter } from '@orbit/platform-ios';

const runtime = createIosRuntimeAdapter();
const CURRENT_DATE = '2026-04-09';

function createProjectRecord(overrides: Partial<ProjectRecord> & Pick<ProjectRecord, 'id' | 'title'>): ProjectRecord {
  return {
    kind: 'project',
    id: overrides.id,
    workspaceId: 'orbit-workspace',
    title: overrides.title,
    status: overrides.status ?? 'active',
    createdAt: overrides.createdAt ?? '2026-04-01T09:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-04-01T09:00:00.000Z',
    deletedAt: overrides.deletedAt,
    lastReviewedAt: overrides.lastReviewedAt ?? null
  };
}

function createTaskRecord(overrides: Partial<TaskRecord> & Pick<TaskRecord, 'id' | 'title'>): TaskRecord {
  return {
    kind: 'task',
    id: overrides.id,
    workspaceId: 'orbit-workspace',
    projectId: overrides.projectId ?? null,
    title: overrides.title,
    status: overrides.status ?? 'todo',
    createdAt: overrides.createdAt ?? '2026-04-01T09:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-04-01T09:00:00.000Z',
    deletedAt: overrides.deletedAt,
    todayOn: overrides.todayOn ?? null,
    focusRank: overrides.focusRank ?? null,
    completedAt: overrides.completedAt ?? null,
    lastReviewedAt: overrides.lastReviewedAt ?? null
  };
}

const mobileFeature = createMobileFeatureModule({
  host: {
    kind: 'ios',
    navigationStyle: 'stack'
  },
  locale: 'zh-CN',
  activeSection: 'today',
  currentDate: CURRENT_DATE,
  userIntent: '让 iOS 兼容宿主跟上新的 desktop P0 shell，而不是继续渲染 reader 语义。',
  projects: [
    createProjectRecord({
      id: 'project-ios-shell',
      title: 'Orbit desktop compatibility pass',
      lastReviewedAt: '2026-04-08T18:30:00.000Z'
    })
  ],
  tasks: [
    createTaskRecord({
      id: 'task-focus',
      projectId: 'project-ios-shell',
      title: '映射 Today / Focus 摘要到 iOS',
      status: 'doing',
      todayOn: CURRENT_DATE,
      focusRank: 1,
      lastReviewedAt: '2026-04-09T08:30:00.000Z'
    }),
    createTaskRecord({
      id: 'task-review',
      projectId: 'project-ios-shell',
      title: '保留最小回顾摘要',
      status: 'done',
      completedAt: '2026-04-09T10:15:00.000Z',
      lastReviewedAt: '2026-04-09T10:30:00.000Z'
    }),
    createTaskRecord({
      id: 'task-carry',
      projectId: 'project-ios-shell',
      title: '补齐剩余真机接线',
      status: 'todo',
      todayOn: '2026-04-08',
      focusRank: 2,
      lastReviewedAt: null
    })
  ]
});
const capabilities = runtime.capabilityHost.list();
const activeProject = mobileFeature.shell.activeProject;

const sections = [
  {
    title: 'Loop summary',
    items: [
      `${mobileFeature.shell.planner.intentLabel}：${mobileFeature.shell.planner.intent}`,
      mobileFeature.shell.planner.summary,
      `Focus：${mobileFeature.screens.focus.focusTitle ?? '待选择'}`
    ]
  },
  {
    title: 'iOS 宿主能力',
    items: capabilities
  }
] as const;

export default function HomeScreen(): JSX.Element {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.heroCard}>
        <Text style={styles.kicker}>Expo Router / React Native Host</Text>
        <Text style={styles.title}>Orbit iOS compatibility shell</Text>
        <Text style={styles.body}>
          iOS 现在只做最小兼容宿主：复用新的 deterministic project loop shell，保留原生能力桥接，不再继续构造 reader demo。
        </Text>
        <View style={styles.chipRow}>
          {mobileFeature.tabs.map((tab) => (
            <View key={tab.id} style={styles.chip}>
              <Text style={styles.chipText}>{tab.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>活跃项目</Text>
        <Text style={styles.body}>{activeProject?.title ?? '暂无活跃项目'}</Text>
        <Text style={styles.note}>
          {activeProject
            ? `${activeProject.openTaskCount} 个开放任务 · ${activeProject.todayCount} 个已进入 Today`
            : '等待上层注入项目数据。'}
        </Text>
      </View>

      {sections.map((section) => (
        <View key={section.title} style={styles.card}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {section.items.map((item) => (
            <View key={item} style={styles.listItem}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.body}>{item}</Text>
            </View>
          ))}
        </View>
      ))}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Today / Focus</Text>
        {mobileFeature.shell.today.map((task) => (
          <View key={task.id} style={styles.listItem}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.body}>
              {task.title} · rank {task.focusRank ?? '—'}
            </Text>
          </View>
        ))}
        <Text style={styles.note}>当前 Focus：{mobileFeature.screens.focus.focusTitle ?? '待选择'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Review snapshot</Text>
        <Text style={styles.body}>{mobileFeature.shell.review.summary}</Text>
        {mobileFeature.shell.review.completedToday.map((task) => (
          <View key={task.id} style={styles.listItem}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.body}>完成 · {task.title}</Text>
          </View>
        ))}
        {mobileFeature.shell.review.carryForward.map((task) => (
          <View key={task.id} style={styles.listItem}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.body}>延续 · {task.title}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>后续真机接入</Text>
        <Text style={styles.body}>
          从 {runtime.platform} runtime adapter 继续扩展通知、分享、生物识别等原生能力，但保持 iOS 宿主只消费新的 shell contract。
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
    padding: 20
  },
  heroCard: {
    backgroundColor: '#111827',
    borderColor: '#1f2937',
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    padding: 20
  },
  card: {
    backgroundColor: '#0f172a',
    borderColor: '#1e293b',
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    padding: 16
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  chip: {
    backgroundColor: '#082f49',
    borderColor: '#155e75',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  chipText: {
    color: '#e0f2fe',
    fontSize: 13,
    fontWeight: '600'
  },
  kicker: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase'
  },
  title: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '700'
  },
  sectionTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '600'
  },
  body: {
    color: '#cbd5e1',
    fontSize: 15,
    lineHeight: 22
  },
  note: {
    color: '#fda4af',
    fontSize: 14,
    lineHeight: 20
  },
  listItem: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8
  },
  bullet: {
    color: '#38bdf8',
    fontSize: 16,
    lineHeight: 22
  }
});
