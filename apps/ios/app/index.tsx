import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { ReaderArticleSummary, WorkspaceSection } from '@orbit/app-viewmodels';
import { createMobileFeatureModule } from '@orbit/feature-mobile';
import { createIosRuntimeAdapter } from '@orbit/platform-ios';

const runtime = createIosRuntimeAdapter();
const activeSection: WorkspaceSection = 'inbox';
const articles: ReaderArticleSummary[] = [
  {
    id: 'ios-host-capture',
    title: 'iOS 宿主承接移动捕捉与轻量回看。',
    excerpt: '共享业务内核在移动端落成原生化表达，宿主负责原生能力桥接。',
    isRead: false,
    updatedAt: '2026-04-09T09:20:00.000Z'
  },
  {
    id: 'ios-host-bridge',
    title: '平台差异进入 @orbit/platform-ios，而不是写进 feature 层。',
    excerpt: '通知、分享扩展、后台刷新、生物识别都通过平台适配层向上暴露。',
    isRead: true,
    updatedAt: '2026-04-08T12:10:00.000Z'
  }
];
const mobileFeature = createMobileFeatureModule({
  host: {
    kind: 'ios',
    navigationStyle: 'stack'
  },
  locale: 'zh-CN',
  activeSection,
  searchQuery: '',
  articles
});
const capabilities = runtime.capabilityHost.list();

const sections = [
  {
    title: "共享业务内核",
    items: mobileFeature.tabs.map((tab) => tab.label)
  },
  {
    title: "iOS 宿主能力",
    items: capabilities
  }
] as const;

export default function HomeScreen(): JSX.Element {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.heroCard}>
        <Text style={styles.kicker}>Expo Router / React Native Host</Text>
        <Text style={styles.title}>Orbit iOS 宿主脚手架</Text>
        <Text style={styles.body}>
          这里负责挂载共享业务内核与移动端特性层，并把 iOS 设备能力通过平台桥接暴露给上层。
        </Text>
      </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>宿主边界</Text>
          <Text style={styles.body}>
            iOS 宿主负责原生导航、通知、分享扩展、后台刷新与安全存储；共享 feature 只消费平台能力，不直接触碰宿主实现。
          </Text>
          <Text style={styles.note}>
            iOS 只复用核心逻辑，不复用 DOM 工作台，也不直接承接桌面 / Web 的 UI 实现。
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
        <Text style={styles.sectionTitle}>{mobileFeature.shell.title}</Text>
        <Text style={styles.body}>
          搜索占位：{mobileFeature.shell.searchPlaceholder}
        </Text>
        <Text style={styles.body}>
          Reader 内容数：{mobileFeature.screens.reader.articleIds.length}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>后续真机接入</Text>
        <Text style={styles.body}>
          从 {runtime.platform} runtime adapter 继续扩展原生桥接，把通知、分享扩展、后台刷新、生物识别等能力收敛到
          {' '}@orbit/platform-ios，再由 @orbit/feature-mobile 消费。
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
    backgroundColor: "#111827",
    borderColor: "#1f2937",
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    padding: 20
  },
  card: {
    backgroundColor: "#0f172a",
    borderColor: "#1e293b",
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    padding: 16
  },
  kicker: {
    color: "#38bdf8",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  title: {
    color: "#f8fafc",
    fontSize: 28,
    fontWeight: "700"
  },
  sectionTitle: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "600"
  },
  body: {
    color: "#cbd5e1",
    fontSize: 15,
    lineHeight: 22
  },
  note: {
    color: "#fda4af",
    fontSize: 14,
    lineHeight: 20
  },
  listItem: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 8
  },
  bullet: {
    color: "#38bdf8",
    fontSize: 16,
    lineHeight: 22
  }
});
