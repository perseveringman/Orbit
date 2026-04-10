import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { TextStyle } from 'react-native';

import type { ProjectRecord, TaskRecord } from '@orbit/domain';
import { createMobileFeatureModule } from '@orbit/feature-mobile';
import { createIosRuntimeAdapter } from '@orbit/platform-ios';
import { createNativeThemeContract } from '@orbit/ui-native';

const runtime = createIosRuntimeAdapter();
const CURRENT_DATE = '2026-04-09';
const theme = createNativeThemeContract('light');

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
const ACTIVE_TAB = 'home' as const;

type FontWeight = TextStyle['fontWeight'];
const fw = {
  medium: theme.typography.fontWeight.medium as FontWeight,
  semibold: theme.typography.fontWeight.semibold as FontWeight,
  bold: theme.typography.fontWeight.bold as FontWeight,
};

export default function HomeScreen(): JSX.Element {
  return (
    <ScrollView
      style={{ backgroundColor: theme.palette.bg.back }}
      contentContainerStyle={styles.container}
    >
      {/* Sidebar-like navigation pills */}
      <View style={styles.navRow}>
        {mobileFeature.tabs.map((tab) => (
          <Pressable key={tab.id} style={[styles.navPill, tab.id === ACTIVE_TAB && styles.navPillActive]}>
            <Text style={[styles.navPillText, tab.id === ACTIVE_TAB && styles.navPillTextActive]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Active Project Card */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={[styles.typeIcon, { backgroundColor: theme.objectTypes.project.bg }]}>
            <Text style={{ color: theme.objectTypes.project.text, fontSize: 12, fontWeight: '700' }}>P</Text>
          </View>
          <Text style={styles.sectionTitle}>
            {activeProject?.title ?? '暂无活跃项目'}
          </Text>
        </View>
        {activeProject && (
          <Text style={styles.metaText}>
            {activeProject.openTaskCount} 个开放任务 · {activeProject.todayCount} 个已进入 Today
          </Text>
        )}
      </View>

      {/* Today Section */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionLabel}>Today</Text>
        {mobileFeature.shell.today.map((task) => (
          <View key={task.id} style={styles.taskCard}>
            <View style={styles.taskHeader}>
              <Text style={styles.taskTitle}>{task.title}</Text>
              <View style={[styles.statusBadge,
                task.status === 'doing' ? styles.statusDoing : styles.statusTodo
              ]}>
                <Text style={styles.statusText}>
                  {task.status === 'doing' ? '进行中' : '待做'}
                </Text>
              </View>
            </View>
            <Text style={styles.metaText}>
              {task.projectTitle ?? '未归属项目'} · Focus #{task.focusRank ?? '—'}
            </Text>
          </View>
        ))}
      </View>

      {/* Focus Section */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionLabel}>Focus</Text>
        {mobileFeature.screens.focus.focusTitle ? (
          <View style={styles.focusCard}>
            <Text style={styles.focusTitle}>{mobileFeature.screens.focus.focusTitle}</Text>
            <Text style={styles.metaText}>当前聚焦任务</Text>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🎯</Text>
            <Text style={styles.emptyText}>今天还没有聚焦任务</Text>
          </View>
        )}
      </View>

      {/* Review Section */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionLabel}>Review</Text>
        <Text style={styles.bodyText}>{mobileFeature.shell.review.summary}</Text>

        {mobileFeature.shell.review.completedToday.length > 0 && (
          <View style={styles.reviewGroup}>
            <Text style={styles.reviewGroupTitle}>今日完成</Text>
            {mobileFeature.shell.review.completedToday.map((task) => (
              <View key={task.id} style={styles.reviewItem}>
                <Text style={styles.checkmark}>✓</Text>
                <Text style={styles.reviewText}>{task.title}</Text>
              </View>
            ))}
          </View>
        )}

        {mobileFeature.shell.review.carryForward.length > 0 && (
          <View style={styles.reviewGroup}>
            <Text style={styles.reviewGroupTitle}>需要延续</Text>
            {mobileFeature.shell.review.carryForward.map((task) => (
              <View key={task.id} style={styles.reviewItem}>
                <Text style={styles.carryIcon}>→</Text>
                <Text style={styles.reviewText}>{task.title}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Capabilities */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionLabel}>平台能力</Text>
        <View style={styles.capRow}>
          {capabilities.map((cap) => (
            <View key={cap} style={styles.capBadge}>
              <Text style={styles.capText}>{cap}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    paddingBottom: theme.spacing['2xl'],
  },
  navRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  navPill: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.full,
    backgroundColor: theme.palette.bg.el,
    borderWidth: 1,
    borderColor: theme.palette.border.el,
  },
  navPillActive: {
    backgroundColor: theme.palette.bg.elActive,
    borderColor: theme.palette.border.elHover,
  },
  navPillText: {
    color: theme.palette.text.secondary,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: fw.medium,
  },
  navPillTextActive: {
    color: theme.palette.text.primary,
    fontWeight: fw.semibold,
  },
  sectionCard: {
    backgroundColor: theme.palette.bg.base,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.palette.border.base,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  typeIcon: {
    width: 28,
    height: 28,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    color: theme.palette.text.subtle,
    fontSize: theme.typography.fontSize.xs,
    fontWeight: fw.semibold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: theme.palette.text.primary,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: fw.bold,
  },
  taskCard: {
    backgroundColor: theme.palette.bg.front,
    borderRadius: theme.radius.base,
    borderWidth: 1,
    borderColor: theme.palette.border.base,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  taskTitle: {
    color: theme.palette.text.primary,
    fontSize: theme.typography.fontSize.base,
    fontWeight: fw.medium,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
  },
  statusDoing: {
    backgroundColor: theme.palette.bg.buttonPrimary + '22',
  },
  statusTodo: {
    backgroundColor: theme.palette.bg.el,
  },
  statusText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: fw.medium,
    color: theme.palette.text.secondary,
  },
  metaText: {
    color: theme.palette.text.subtle,
    fontSize: theme.typography.fontSize.sm,
    lineHeight: theme.typography.lineHeight.relaxed * theme.typography.fontSize.sm,
  },
  bodyText: {
    color: theme.palette.text.secondary,
    fontSize: theme.typography.fontSize.base,
    lineHeight: theme.typography.lineHeight.base * theme.typography.fontSize.base,
  },
  focusCard: {
    backgroundColor: theme.palette.bg.front,
    borderRadius: theme.radius.base,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.palette.border.base,
    gap: theme.spacing.xs,
  },
  focusTitle: {
    color: theme.palette.text.primary,
    fontSize: theme.typography.fontSize.md,
    fontWeight: fw.semibold,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  emptyIcon: {
    fontSize: 32,
  },
  emptyText: {
    color: theme.palette.text.subtle,
    fontSize: theme.typography.fontSize.sm,
  },
  reviewGroup: {
    gap: theme.spacing.xs,
  },
  reviewGroupTitle: {
    color: theme.palette.text.secondary,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: fw.semibold,
    marginTop: theme.spacing.xs,
  },
  reviewItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
  },
  checkmark: {
    color: theme.palette.bg.buttonPrimary,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: fw.bold,
  },
  carryIcon: {
    color: theme.palette.text.subtle,
    fontSize: theme.typography.fontSize.sm,
  },
  reviewText: {
    color: theme.palette.text.secondary,
    fontSize: theme.typography.fontSize.sm,
    flex: 1,
    lineHeight: theme.typography.lineHeight.base * theme.typography.fontSize.sm,
  },
  capRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  capBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    backgroundColor: theme.palette.bg.el,
    borderWidth: 1,
    borderColor: theme.palette.border.el,
  },
  capText: {
    color: theme.palette.text.secondary,
    fontSize: theme.typography.fontSize.xs,
    fontWeight: fw.medium,
  },
});
