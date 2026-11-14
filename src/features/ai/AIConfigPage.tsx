import { useEffect, useRef, useState } from "react";
import {
  Bot,
  BrainCircuit,
  Database,
  Ghost,
  Images,
  MessageSquareText,
  Plus,
  Save,
  Settings2,
  Trash2,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { apiFetch } from "@/lib/api";
import { useTopbar } from "@/components/layout/TopbarContext";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { cn } from "@/lib/utils";
import { DatasourceMultiSelectField } from "@/features/mioku/DatasourceMultiSelectField";
import type { DatasourceOption } from "@/features/plugin-config/datasource-utils";
import { StickerPicker, type StickerOption } from "@/features/ai/StickerPicker";
import { ProvidersModelsTab } from "@/features/ai/ProvidersModelsTab";
import { ThemePackSection } from "@/features/ai/ThemePackSection";
import {
  EMPTY_THEME_CATALOG,
  createCustomThemeId,
  isBuiltinThemeId,
  type EmotionTheme,
  type ReplyStyleTheme,
  type ThemeCatalog,
} from "@/features/ai/theme-packs";
import { confirm } from "@/components/ui/confirm";

type Strength = "low" | "medium" | "high";

type BaseConfig = {
  apiUrl?: string;
  apiKey?: string;
  model?: string;
  workingModel?: string;
  multimodalWorkingModel?: string;
  isMultimodal?: boolean;
  enableMediaRecognition: boolean;
  ignorePrivateChat: boolean;
  historyCount: number;
  providersManaged?: boolean;
};

type SettingsConfig = {
  searxng: {
    enabled: boolean;
    baseUrl: string;
    timeoutMs: number;
    defaultLimit: number;
    maxLimit: number;
    maxSearchCount: number;
  };
  webReader: {
    enabled: boolean;
    useWorkingModel: boolean;
    timeoutMs: number;
    maxHtmlBytes: number;
    maxExtractedChars: number;
    browserTimeoutMs: number;
    allowedContentTypes: string[];
  };
  audio: {
    enabled: boolean;
  };
  blacklistGroups: string[];
  whitelistGroups: string[];
  mediaAnalysisBlacklistUsers: string[];
  maxSessions: number;
  enableExternalSkills: boolean;
  allowedExternalSkills: string[];
  stream: boolean;
  enableTypingDelay: boolean;
  typingDelayMaxTotalMs: number;
  enableMarkdownScreenshot: boolean;
  debug: boolean;
  outputLengthConstraintStrength: Strength;
  toolCallConstraintStrength: Strength;
  emojiUsageConstraintStrength: Strength;
  audioUsageConstraintStrength: Strength;
  markdownUsageConstraintStrength: Strength;
  groupStructuredHistoryTtlMs: number;
  nicknames: string[];
  cooldownAfterReplyMs: number;
  aiRequestLimits: {
    userRpm: number;
    groupRpm: number;
    windowMs: number;
  };
  dynamicDelay: {
    enabled: boolean;
    interactionWindowMs: number;
    baseDelayMs: number;
    maxDelayMs: number;
  };
};

type EmotionConfig = {
  defaultEmotion: string;
  updateIntervalMs: number;
  emotions: Record<string, { examples: string[] }>;
};

type PersonalizationConfig = {
  persona: string;
  replyStyleTheme: string;
  emotionTheme: string;
  pseudoHuman: {
    enabled: boolean;
  };
  emotion: EmotionConfig;
  replyStyle: {
    baseStyle: string;
    multipleStyles: string[];
    multipleProbability: number;
  };
  topic: {
    enabled: boolean;
    windowHours: number;
    historyWindowCount: number;
  };
  emoji: {
    enabled: boolean;
    characters: string[];
    stickers: string[];
  };
  expression: {
    enabled: boolean;
    lookbackMessages: number;
    sampleSize: number;
  };
};

type AIResources = {
  instances: string[];
  skills: string[];
  tools: string[];
};

type MemoryConfig = {
  enabled: boolean;
  extractModel: "working" | "main";
  windowMinutes: number;
  minMessagesPerWindow: number;
  maxBufferMessages: number;
  extractIntervalMs: number;
  maxCharsPerWindow: number;
  minConfidence: number;
  maxItemsPerGroup: number;
  retentionMonths: number;
  injectTopK: number;
  injectMaxChars: number;
  injectTimeoutMs: number;
  profileEnabled: boolean;
  profileUpdateEvery: number;
  recallToolsEnabled: boolean;
  recallToolBudget: number;
  contextLookbackDays: number;
  cacheTtlMs: number;
  indexMessages: boolean;
  indexMessageMinChars: number;
  indexMessageRetentionDays: number;
  sourceTraceback: boolean;
  sourceTracebackLimit: number;
};

const emptyMemoryConfig: MemoryConfig = {
  enabled: true,
  extractModel: "working",
  windowMinutes: 30,
  minMessagesPerWindow: 12,
  maxBufferMessages: 80,
  extractIntervalMs: 300000,
  maxCharsPerWindow: 4000,
  minConfidence: 0.55,
  maxItemsPerGroup: 3000,
  retentionMonths: 3,
  injectTopK: 6,
  injectMaxChars: 700,
  injectTimeoutMs: 250,
  profileEnabled: true,
  profileUpdateEvery: 40,
  recallToolsEnabled: true,
  recallToolBudget: 3,
  contextLookbackDays: 30,
  cacheTtlMs: 90000,
  indexMessages: false,
  indexMessageMinChars: 8,
  indexMessageRetentionDays: 14,
  sourceTraceback: true,
  sourceTracebackLimit: 3,
};

type ConfigTab =
  | "model"
  | "reply"
  | "context"
  | "memory"
  | "tools"
  | "runtime"
  | "stickers";

const configTabs = [
  { id: "model", label: "提供商与模型", icon: BrainCircuit },
  { id: "reply", label: "回复与角色", icon: MessageSquareText },
  { id: "context", label: "上下文与主动性", icon: Bot },
  { id: "memory", label: "记忆", icon: Database },
  { id: "tools", label: "工具与媒体", icon: Wrench },
  { id: "runtime", label: "群聊与运行", icon: Settings2 },
  { id: "stickers", label: "表情包", icon: Images },
] satisfies Array<{
  id: ConfigTab;
  label: string;
  icon: LucideIcon;
}>;

const emptyBaseConfig: BaseConfig = {
  enableMediaRecognition: true,
  ignorePrivateChat: true,
  historyCount: 100,
};

const emptySettingsConfig: SettingsConfig = {
  searxng: {
    enabled: false,
    baseUrl: "",
    timeoutMs: 8000,
    defaultLimit: 5,
    maxLimit: 8,
    maxSearchCount: 2,
  },
  webReader: {
    enabled: true,
    useWorkingModel: true,
    timeoutMs: 10000,
    maxHtmlBytes: 1500000,
    maxExtractedChars: 12000,
    browserTimeoutMs: 15000,
    allowedContentTypes: ["text/html", "application/xhtml+xml", "text/plain"],
  },
  audio: {
    enabled: false,
  },
  blacklistGroups: [],
  whitelistGroups: [],
  mediaAnalysisBlacklistUsers: [],
  maxSessions: 100,
  enableExternalSkills: true,
  allowedExternalSkills: [],
  stream: true,
  enableTypingDelay: true,
  typingDelayMaxTotalMs: 10000,
  enableMarkdownScreenshot: true,
  debug: false,
  outputLengthConstraintStrength: "medium",
  toolCallConstraintStrength: "medium",
  emojiUsageConstraintStrength: "medium",
  audioUsageConstraintStrength: "medium",
  markdownUsageConstraintStrength: "medium",
  groupStructuredHistoryTtlMs: 600000,
  nicknames: [],
  cooldownAfterReplyMs: 20000,
  aiRequestLimits: {
    userRpm: 3,
    groupRpm: 6,
    windowMs: 60000,
  },
  dynamicDelay: {
    enabled: true,
    interactionWindowMs: 60000,
    baseDelayMs: 30000,
    maxDelayMs: 300000,
  },
};

const emptyPersonalizationConfig: PersonalizationConfig = {
  persona: "",
  replyStyleTheme: "",
  emotionTheme: "",
  pseudoHuman: {
    enabled: false,
  },
  emotion: {
    defaultEmotion: "default",
    updateIntervalMs: 3600000,
    emotions: {
      default: { examples: [] },
      happy: { examples: [] },
      sad: { examples: [] },
      angry: { examples: [] },
      fear: { examples: [] },
      surprise: { examples: [] },
    },
  },
  replyStyle: {
    baseStyle: "",
    multipleStyles: [],
    multipleProbability: 0.2,
  },
  topic: {
    enabled: true,
    windowHours: 5,
    historyWindowCount: 3,
  },
  emoji: {
    enabled: false,
    characters: [],
    stickers: [],
  },
  expression: {
    enabled: true,
    lookbackMessages: 200,
    sampleSize: 30,
  },
};

function linesToArray(value: string): string[] {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((item) => item.trim());
}

function arrayToLines(value: string[]): string {
  return value.join("\n");
}

function compactLineArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item || "").trim()).filter(Boolean);
}

function sanitizeSettingsForSave(settings: SettingsConfig): SettingsConfig {
  const { imageAnalysisBlacklistUsers: _legacy, ...nextSettings } =
    settings as SettingsConfig & { imageAnalysisBlacklistUsers?: string[] };
  return {
    ...nextSettings,
    nicknames: compactLineArray(nextSettings.nicknames),
    blacklistGroups: compactLineArray(nextSettings.blacklistGroups),
    whitelistGroups: compactLineArray(nextSettings.whitelistGroups),
    mediaAnalysisBlacklistUsers: compactLineArray(
      nextSettings.mediaAnalysisBlacklistUsers,
    ),
    webReader: {
      ...nextSettings.webReader,
      allowedContentTypes: compactLineArray(
        nextSettings.webReader.allowedContentTypes,
      ),
    },
  };
}

function cloneEmotionEntries(
  emotions: Record<string, { examples: string[] }>,
): Record<string, { examples: string[] }> {
  const next: Record<string, { examples: string[] }> = {};
  for (const [name, entry] of Object.entries(emotions || {})) {
    next[name] = { examples: [...(entry.examples || [])] };
  }
  return next;
}

function buildThemesForSave(
  themes: ThemeCatalog,
  personalization: PersonalizationConfig,
): { reply: ReplyStyleTheme[]; emotion: EmotionTheme[] } {
  const reply = themes.reply
    .filter((theme) => !theme.builtin)
    .map((theme) => ({ ...theme, multipleStyles: [...theme.multipleStyles] }));
  const emotion = themes.emotion
    .filter((theme) => !theme.builtin)
    .map((theme) => ({
      ...theme,
      emotions: cloneEmotionEntries(theme.emotions),
    }));

  const replyId = personalization.replyStyleTheme;
  if (replyId && !isBuiltinThemeId(replyId)) {
    const target = reply.find((theme) => theme.id === replyId);
    if (target) {
      target.persona = personalization.persona;
      target.baseStyle = personalization.replyStyle.baseStyle;
      target.multipleStyles = [...personalization.replyStyle.multipleStyles];
      target.multipleProbability =
        personalization.replyStyle.multipleProbability;
    }
  }

  const emotionId = personalization.emotionTheme;
  if (emotionId && !isBuiltinThemeId(emotionId)) {
    const target = emotion.find((theme) => theme.id === emotionId);
    if (target) {
      target.defaultEmotion = personalization.emotion.defaultEmotion;
      target.updateIntervalMs = personalization.emotion.updateIntervalMs;
      target.emotions = cloneEmotionEntries(personalization.emotion.emotions);
    }
  }

  return { reply, emotion };
}

function normalizeEmotionConfig(value: unknown): EmotionConfig {
  const source = (
    value && typeof value === "object" ? value : {}
  ) as Partial<EmotionConfig>;
  const defaultConfig = emptyPersonalizationConfig.emotion;
  const rawEmotions =
    source.emotions && typeof source.emotions === "object"
      ? source.emotions
      : defaultConfig.emotions;
  const emotions: EmotionConfig["emotions"] = {};

  for (const [name, entry] of Object.entries(rawEmotions)) {
    const normalizedName = name.trim().toLowerCase();
    if (!normalizedName) continue;
    const rawEntry = entry && typeof entry === "object" ? entry : {};
    emotions[normalizedName] = {
      examples: compactLineArray((rawEntry as { examples?: unknown }).examples),
    };
  }

  const allowedDefaultEmotions = new Set(["default", ...Object.keys(emotions)]);
  const defaultEmotionCandidate = String(
    source.defaultEmotion || defaultConfig.defaultEmotion,
  )
    .trim()
    .toLowerCase();
  const defaultEmotion = allowedDefaultEmotions.has(defaultEmotionCandidate)
    ? defaultEmotionCandidate
    : "default";
  if (!emotions[defaultEmotion]) {
    emotions[defaultEmotion] = { examples: [] };
  }

  return {
    defaultEmotion,
    updateIntervalMs:
      typeof source.updateIntervalMs === "number" && source.updateIntervalMs > 0
        ? source.updateIntervalMs
        : defaultConfig.updateIntervalMs,
    emotions,
  };
}

function sanitizePersonalizationForSave(
  personalization: PersonalizationConfig,
): PersonalizationConfig {
  return {
    ...personalization,
    replyStyleTheme: String(personalization.replyStyleTheme || "").trim(),
    emotionTheme: String(personalization.emotionTheme || "").trim(),
    pseudoHuman: {
      enabled: Boolean(personalization.pseudoHuman?.enabled),
    },
    emotion: normalizeEmotionConfig(personalization.emotion),
    replyStyle: {
      ...personalization.replyStyle,
      multipleStyles: compactLineArray(
        personalization.replyStyle.multipleStyles,
      ),
    },
    emoji: {
      ...personalization.emoji,
      characters: compactLineArray(personalization.emoji.characters),
      stickers: compactLineArray(personalization.emoji.stickers),
    },
  };
}

function normalizeEscapedNewlines(value: string): string {
  return String(value || "")
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n");
}

export function AIConfigPage() {
  const [base, setBase] = useState<BaseConfig>(emptyBaseConfig);
  const [personalization, setPersonalization] = useState<PersonalizationConfig>(
    emptyPersonalizationConfig,
  );
  const [settings, setSettings] = useState<SettingsConfig>(emptySettingsConfig);
  const [memory, setMemory] = useState<MemoryConfig>(emptyMemoryConfig);
  const [themes, setThemes] = useState<ThemeCatalog>(EMPTY_THEME_CATALOG);
  const [editingReplyTheme, setEditingReplyTheme] = useState(false);
  const [editingEmotionTheme, setEditingEmotionTheme] = useState(false);
  const inlinePersonalizationRef = useRef<{
    persona: string;
    replyStyle: PersonalizationConfig["replyStyle"];
    emotion: EmotionConfig;
  } | null>(null);
  const [resources, setResources] = useState<AIResources>({
    instances: [],
    skills: [],
    tools: [],
  });
  const [groupOptions, setGroupOptions] = useState<DatasourceOption[]>([]);
  const [stickerOptions, setStickerOptions] = useState<StickerOption[]>([]);
  const [activeTab, setActiveTab] = useState<ConfigTab>("model");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const initialSnapshotRef = useRef("");
  const { setLeftContent, setRightContent } = useTopbar();

  useUnsavedChanges(hasChanges, {
    message: "AI 设置还没有保存，确定要离开吗？",
  });

  const load = async (options: { silent?: boolean } = {}) => {
    if (!options.silent) setLoading(true);
    try {
      const [
        baseRes,
        personalizationRes,
        settingsRes,
        instancesRes,
        skillsRes,
        groupsRes,
        stickersRes,
        memoryRes,
        themesRes,
      ] = await Promise.all([
        apiFetch<{ data: BaseConfig }>("/api/ai/base"),
        apiFetch<{ data: PersonalizationConfig }>("/api/ai/personalization"),
        apiFetch<{ data: SettingsConfig }>("/api/ai/settings"),
        apiFetch<{ data: Array<string | { name: string }> }>(
          "/api/ai/instances",
        ),
        apiFetch<{ data: { skills: string[]; tools: string[] } }>(
          "/api/ai/skills",
        ),
        apiFetch<{ data: DatasourceOption[] }>(
          "/api/plugin-config/datasources/qq_groups",
        ),
        apiFetch<{ data: StickerOption[] }>("/api/ai/stickers").catch(() => ({
          data: [],
        })),
        apiFetch<{ data: Partial<MemoryConfig> }>("/api/ai/memory").catch(
          () => ({
            data: {},
          }),
        ),
        apiFetch<{ data: ThemeCatalog }>("/api/ai/themes").catch(() => ({
          data: EMPTY_THEME_CATALOG,
        })),
      ]);

      const nextBase = { ...emptyBaseConfig, ...(baseRes.data || {}) };
      const rawExpression = (personalizationRes.data?.expression || {}) as {
        enabled?: boolean;
        sampleSize?: number;
        lookbackMessages?: number;
      };
      const nextThemes = themesRes.data || EMPTY_THEME_CATALOG;
      const rawPersonalization = personalizationRes.data || {};
      const replyTheme = nextThemes.reply.find(
        (theme) =>
          theme.id === String(rawPersonalization.replyStyleTheme || "").trim(),
      );
      const emotionTheme = nextThemes.emotion.find(
        (theme) =>
          theme.id === String(rawPersonalization.emotionTheme || "").trim(),
      );
      const inlineReplyStyle = {
        ...emptyPersonalizationConfig.replyStyle,
        ...(rawPersonalization.replyStyle || {}),
        baseStyle: normalizeEscapedNewlines(
          rawPersonalization.replyStyle?.baseStyle || "",
        ),
      };
      const inlineEmotion = normalizeEmotionConfig(rawPersonalization.emotion);
      inlinePersonalizationRef.current = {
        persona: normalizeEscapedNewlines(rawPersonalization.persona || ""),
        replyStyle: inlineReplyStyle,
        emotion: inlineEmotion,
      };

      const nextPersonalization = {
        ...emptyPersonalizationConfig,
        ...rawPersonalization,
        persona: replyTheme
          ? replyTheme.persona
          : normalizeEscapedNewlines(rawPersonalization.persona || ""),
        replyStyleTheme: replyTheme ? replyTheme.id : "",
        emotionTheme: emotionTheme ? emotionTheme.id : "",
        pseudoHuman: {
          enabled: Boolean(rawPersonalization.pseudoHuman?.enabled),
        },
        emotion: emotionTheme
          ? {
              defaultEmotion: emotionTheme.defaultEmotion,
              updateIntervalMs: emotionTheme.updateIntervalMs,
              emotions: cloneEmotionEntries(emotionTheme.emotions),
            }
          : inlineEmotion,
        replyStyle: replyTheme
          ? {
              baseStyle: replyTheme.baseStyle,
              multipleStyles: [...replyTheme.multipleStyles],
              multipleProbability: replyTheme.multipleProbability,
            }
          : inlineReplyStyle,
        topic: {
          ...emptyPersonalizationConfig.topic,
          ...(rawPersonalization.topic || {}),
        },
        emoji: {
          ...emptyPersonalizationConfig.emoji,
          ...(rawPersonalization.emoji || {}),
          characters: compactLineArray(rawPersonalization.emoji?.characters),
          stickers: compactLineArray(rawPersonalization.emoji?.stickers),
        },
        expression: {
          ...emptyPersonalizationConfig.expression,
          ...rawExpression,
          lookbackMessages:
            rawExpression.lookbackMessages ??
            emptyPersonalizationConfig.expression.lookbackMessages,
        },
      };
      const nextSettings = {
        ...emptySettingsConfig,
        ...(settingsRes.data || {}),
        mediaAnalysisBlacklistUsers:
          (settingsRes.data as any)?.mediaAnalysisBlacklistUsers ??
          (settingsRes.data as any)?.imageAnalysisBlacklistUsers ??
          [],
        searxng: {
          ...emptySettingsConfig.searxng,
          ...(settingsRes.data?.searxng || {}),
        },
        webReader: {
          ...emptySettingsConfig.webReader,
          ...(settingsRes.data?.webReader || {}),
        },
        audio: {
          ...emptySettingsConfig.audio,
          ...(settingsRes.data?.audio || {}),
        },
        aiRequestLimits: {
          ...emptySettingsConfig.aiRequestLimits,
          ...(settingsRes.data?.aiRequestLimits || {}),
        },
        dynamicDelay: {
          ...emptySettingsConfig.dynamicDelay,
          ...(settingsRes.data?.dynamicDelay || {}),
        },
      };

      setBase(nextBase);
      setThemes(nextThemes);
      setPersonalization(nextPersonalization);
      setSettings(nextSettings);
      setResources({
        instances: (instancesRes.data || []).map((item) =>
          typeof item === "string" ? item : item.name,
        ),
        skills: skillsRes.data?.skills || [],
        tools: skillsRes.data?.tools || [],
      });
      setGroupOptions(groupsRes.data || []);
      setStickerOptions(stickersRes.data || []);
      const nextMemory: MemoryConfig = {
        ...emptyMemoryConfig,
        ...(memoryRes.data || {}),
      };
      setMemory(nextMemory);

      initialSnapshotRef.current = JSON.stringify({
        base: nextBase,
        personalization: nextPersonalization,
        settings: nextSettings,
        memory: nextMemory,
        themes: nextThemes,
      });
      setHasChanges(false);
    } finally {
      if (!options.silent) setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => {});
  }, []);

  useEffect(() => {
    const currentSnapshot = JSON.stringify({
      base,
      personalization,
      settings,
      memory,
      themes,
    });
    setHasChanges(
      initialSnapshotRef.current.length > 0 &&
        currentSnapshot !== initialSnapshotRef.current,
    );
  }, [base, personalization, settings, memory, themes]);

  async function saveAll() {
    setSaving(true);
    try {
      const nextSettings = sanitizeSettingsForSave(settings);
      const nextPersonalization =
        sanitizePersonalizationForSave(personalization);
      const nextThemes = buildThemesForSave(themes, nextPersonalization);
      const basePayload = {
        enableMediaRecognition: base.enableMediaRecognition,
        ignorePrivateChat: base.ignorePrivateChat,
        historyCount: base.historyCount,
      };
      const [, , , , themesRes] = await Promise.all([
        apiFetch("/api/ai/base", {
          method: "PUT",
          body: JSON.stringify(basePayload),
        }),
        apiFetch("/api/ai/personalization", {
          method: "PUT",
          body: JSON.stringify(nextPersonalization),
        }),
        apiFetch("/api/ai/settings", {
          method: "PUT",
          body: JSON.stringify(nextSettings),
        }),
        apiFetch("/api/ai/memory", {
          method: "PUT",
          body: JSON.stringify(memory),
        }),
        apiFetch<{ data: ThemeCatalog }>("/api/ai/themes", {
          method: "PUT",
          body: JSON.stringify(nextThemes),
        }),
      ]);
      const savedThemes = themesRes?.data || themes;
      setPersonalization(nextPersonalization);
      setSettings(nextSettings);
      setThemes(savedThemes);
      initialSnapshotRef.current = JSON.stringify({
        base,
        personalization: nextPersonalization,
        settings: nextSettings,
        memory,
        themes: savedThemes,
      });
      setHasChanges(false);
      toast.success("设置已保存");
    } finally {
      setSaving(false);
    }
  }

  async function persistThemeSelection(
    replyStyleTheme: string,
    emotionTheme: string,
  ) {
    await apiFetch("/api/ai/themes/selection", {
      method: "PUT",
      body: JSON.stringify({ replyStyleTheme, emotionTheme }),
    });
  }

  async function applyThemeSelection(kind: "reply" | "emotion", id: string) {
    const currentId =
      kind === "reply"
        ? personalization.replyStyleTheme
        : personalization.emotionTheme;
    if (id === currentId) return;

    const exists =
      kind === "reply"
        ? themes.reply.some((theme) => theme.id === id)
        : themes.emotion.some((theme) => theme.id === id);
    if (id && !exists) return;

    if (hasChanges) {
      const ok = await confirm({
        title: "切换主题包",
        message: "当前有未保存的修改，切换后会丢失，确定继续吗？",
        confirmText: "切换",
      });
      if (!ok) return;
    }

    const nextReplyId = kind === "reply" ? id : personalization.replyStyleTheme;
    const nextEmotionId =
      kind === "emotion" ? id : personalization.emotionTheme;
    try {
      await persistThemeSelection(nextReplyId, nextEmotionId);
      await load({ silent: true });
      if (kind === "reply" && isBuiltinThemeId(nextReplyId)) {
        setEditingReplyTheme(false);
      }
      if (kind === "emotion" && isBuiltinThemeId(nextEmotionId)) {
        setEditingEmotionTheme(false);
      }
      toast.success("主题包已切换");
    } catch (err) {
      toast.error(`切换主题包失败: ${err}`);
    }
  }

  async function addTheme(
    kind: "reply" | "emotion",
    theme: ReplyStyleTheme | EmotionTheme,
  ) {
    try {
      const custom = buildThemesForSave(themes, personalization);
      if (kind === "reply") custom.reply.push(theme as ReplyStyleTheme);
      else custom.emotion.push(theme as EmotionTheme);
      await apiFetch("/api/ai/themes", {
        method: "PUT",
        body: JSON.stringify(custom),
      });
      await persistThemeSelection(
        kind === "reply" ? theme.id : personalization.replyStyleTheme,
        kind === "emotion" ? theme.id : personalization.emotionTheme,
      );
      await load({ silent: true });
      if (kind === "reply") setEditingReplyTheme(true);
      else setEditingEmotionTheme(true);
      toast.success("主题包已保存");
    } catch (err) {
      toast.error(`保存主题包失败: ${err}`);
    }
  }

  async function createReplyTheme(name: string) {
    await addTheme("reply", {
      id: createCustomThemeId(),
      name,
      builtin: false,
      persona: "",
      baseStyle: "",
      multipleStyles: [],
      multipleProbability: 0.2,
    });
  }

  async function forkReplyTheme(name: string) {
    const source = themes.reply.find(
      (theme) => theme.id === personalization.replyStyleTheme,
    );
    if (!source) return;
    await addTheme("reply", {
      id: createCustomThemeId(),
      name,
      builtin: false,
      persona: personalization.persona,
      baseStyle: personalization.replyStyle.baseStyle,
      multipleStyles: [...personalization.replyStyle.multipleStyles],
      multipleProbability: personalization.replyStyle.multipleProbability,
    });
  }

  async function createEmotionTheme(name: string) {
    await addTheme("emotion", {
      id: createCustomThemeId(),
      name,
      builtin: false,
      defaultEmotion: "default",
      updateIntervalMs: 60 * 60_000,
      emotions: { default: { examples: [] } },
    });
  }

  async function forkEmotionTheme(name: string) {
    const source = themes.emotion.find(
      (theme) => theme.id === personalization.emotionTheme,
    );
    if (!source) return;
    await addTheme("emotion", {
      id: createCustomThemeId(),
      name,
      builtin: false,
      defaultEmotion: personalization.emotion.defaultEmotion,
      updateIntervalMs: personalization.emotion.updateIntervalMs,
      emotions: cloneEmotionEntries(personalization.emotion.emotions),
    });
  }

  async function renameTheme(kind: "reply" | "emotion", name: string) {
    const id =
      kind === "reply"
        ? personalization.replyStyleTheme
        : personalization.emotionTheme;
    if (!id || isBuiltinThemeId(id)) return;
    try {
      const custom = buildThemesForSave(themes, personalization);
      const list = kind === "reply" ? custom.reply : custom.emotion;
      const target = list.find((theme) => theme.id === id);
      if (!target) return;
      target.name = name;
      await apiFetch("/api/ai/themes", {
        method: "PUT",
        body: JSON.stringify(custom),
      });
      await load({ silent: true });
      toast.success("主题包已重命名");
    } catch (err) {
      toast.error(`重命名主题包失败: ${err}`);
    }
  }

  async function deleteTheme(kind: "reply" | "emotion") {
    const id =
      kind === "reply"
        ? personalization.replyStyleTheme
        : personalization.emotionTheme;
    if (!id || isBuiltinThemeId(id)) return;
    const ok = await confirm({
      title: "删除主题包",
      message: "删除后不可恢复，确定要删除这个主题包吗？",
      confirmText: "删除",
      variant: "danger",
    });
    if (!ok) return;
    try {
      const custom = buildThemesForSave(themes, personalization);
      if (kind === "reply") {
        custom.reply = custom.reply.filter((theme) => theme.id !== id);
      } else {
        custom.emotion = custom.emotion.filter((theme) => theme.id !== id);
      }
      await apiFetch("/api/ai/themes", {
        method: "PUT",
        body: JSON.stringify(custom),
      });
      await persistThemeSelection(
        kind === "reply" ? "" : personalization.replyStyleTheme,
        kind === "emotion" ? "" : personalization.emotionTheme,
      );
      await load({ silent: true });
      if (kind === "reply") setEditingReplyTheme(false);
      else setEditingEmotionTheme(false);
      toast.success("主题包已删除");
    } catch (err) {
      toast.error(`删除主题包失败: ${err}`);
    }
  }

  useEffect(() => {
    setLeftContent(
      <div className="flex items-center gap-2 text-sm font-semibold">
        <BrainCircuit className="h-4 w-4 text-primary" />
        <span>AI 设置</span>
      </div>,
    );

    return () => setLeftContent(null);
  }, [setLeftContent]);

  useEffect(() => {
    setRightContent(
      <Button
        onClick={saveAll}
        disabled={saving || loading || !hasChanges}
        size="sm"
      >
        <Save className="h-4 w-4 sm:mr-1" />
        <span className="hidden sm:inline">
          {saving ? "保存中..." : "保存"}
        </span>
      </Button>,
    );

    return () => setRightContent(null);
  }, [
    base,
    hasChanges,
    loading,
    personalization,
    saving,
    setRightContent,
    settings,
  ]);

  const updateBase = <K extends keyof BaseConfig>(
    key: K,
    value: BaseConfig[K],
  ) => {
    setBase((prev) => ({ ...prev, [key]: value }));
  };

  const updateSettings = <K extends keyof SettingsConfig>(
    key: K,
    value: SettingsConfig[K],
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const toggleAllowedExternalSkill = (skillName: string) => {
    setSettings((prev) => {
      const availableSkills = resources.skills.filter(Boolean);
      const currentSelected =
        prev.allowedExternalSkills.length > 0
          ? prev.allowedExternalSkills.filter((skill) =>
              availableSkills.includes(skill),
            )
          : [...availableSkills];

      const nextSelected = currentSelected.includes(skillName)
        ? currentSelected.filter((skill) => skill !== skillName)
        : [...currentSelected, skillName];

      const normalizedNext = availableSkills.filter((skill) =>
        nextSelected.includes(skill),
      );

      if (normalizedNext.length === 0 && availableSkills.length > 0) {
        return prev;
      }

      return {
        ...prev,
        allowedExternalSkills:
          normalizedNext.length === availableSkills.length
            ? []
            : normalizedNext,
      };
    });
  };

  const setAllowAllExternalSkills = (checked: boolean) => {
    updateSettings(
      "allowedExternalSkills",
      checked ? [] : [...resources.skills],
    );
  };

  const updateEmotionExamples = (emotionName: string, examples: string[]) => {
    const normalizedName = emotionName.trim().toLowerCase();
    if (!normalizedName) return;
    setPersonalization((prev) => ({
      ...prev,
      emotion: {
        ...prev.emotion,
        emotions: {
          ...prev.emotion.emotions,
          [normalizedName]: { examples },
        },
      },
    }));
  };

  const addEmotion = () => {
    let index = 1;
    let name = `custom${index}`;
    while (personalization.emotion.emotions[name]) {
      index += 1;
      name = `custom${index}`;
    }
    updateEmotionExamples(name, []);
  };

  const removeEmotion = (emotionName: string) => {
    setPersonalization((prev) => {
      const normalizedName = emotionName.trim().toLowerCase();
      if (!normalizedName || normalizedName === prev.emotion.defaultEmotion) {
        return prev;
      }
      const { [normalizedName]: _removed, ...nextEmotions } =
        prev.emotion.emotions;
      return {
        ...prev,
        emotion: {
          ...prev.emotion,
          emotions: nextEmotions,
        },
      };
    });
  };

  const renameEmotion = (oldName: string, nextName: string) => {
    const normalizedOldName = oldName.trim().toLowerCase();
    const normalizedNextName = nextName.trim().toLowerCase();
    if (
      !normalizedOldName ||
      !normalizedNextName ||
      normalizedOldName === normalizedNextName
    ) {
      return;
    }
    setPersonalization((prev) => {
      if (!prev.emotion.emotions[normalizedOldName]) return prev;
      const { [normalizedOldName]: entry, ...rest } = prev.emotion.emotions;
      const emotions = {
        ...rest,
        [normalizedNextName]: entry,
      };
      return {
        ...prev,
        emotion: {
          ...prev.emotion,
          defaultEmotion:
            prev.emotion.defaultEmotion === normalizedOldName
              ? normalizedNextName
              : prev.emotion.defaultEmotion,
          emotions,
        },
      };
    });
  };

  const emotionOptions = Array.from(
    new Set(["default", ...Object.keys(personalization.emotion.emotions)]),
  );
  const replyThemeLocked = isBuiltinThemeId(personalization.replyStyleTheme);
  const emotionThemeLocked = isBuiltinThemeId(personalization.emotionTheme);
  const pseudoHumanEnabled = personalization.pseudoHuman.enabled;
  const emotionDisabled = emotionThemeLocked || pseudoHumanEnabled;

  const renderModelTab = () => <ProvidersModelsTab />;

  const renderBehaviorTab = (mode: "reply" | "tools" | "runtime") => (
    <div className="space-y-4">
      {mode === "reply" ? (
        <Card>
          <CardHeader>
            <CardTitle>回复体验</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <Field label="机器人昵称" hint="每行一个，用于触发和识别 bot 称呼">
              <Textarea
                className="min-h-32"
                value={arrayToLines(settings.nicknames)}
                onChange={(e) =>
                  updateSettings("nicknames", linesToArray(e.target.value))
                }
                placeholder={"miku\n未来\n初音"}
              />
            </Field>
            <Field
              label="打字延迟累计上限 (秒)"
              hint="开启打字延迟后，单次回复按内容长度模拟停顿，但整次累计不会超过这个值"
            >
              <NumberInput
                min={0}
                value={settings.typingDelayMaxTotalMs / 1000}
                onValueChange={(value) => {
                  if (value !== null) {
                    updateSettings("typingDelayMaxTotalMs", value * 1000);
                  }
                }}
              />
            </Field>
            <Field
              label="回复长度约束强度"
              hint="越高越严格限制回复长度，越不容易说多"
            >
              <SelectField
                value={settings.outputLengthConstraintStrength}
                onChange={(value) =>
                  updateSettings(
                    "outputLengthConstraintStrength",
                    value as Strength,
                  )
                }
                options={[
                  { label: "低", value: "low" },
                  { label: "中", value: "medium" },
                  { label: "高", value: "high" },
                ]}
              />
            </Field>
          </CardContent>
        </Card>
      ) : null}

      {mode === "runtime" ? (
        <Card>
          <CardHeader>
            <CardTitle>会话与冷却</CardTitle>
            <CardDescription>控制会话保留和群聊回复节奏</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <NumberField
              label="群聊历史消息数"
              hint="每轮对话直接携带的群聊历史条数"
              value={base.historyCount}
              onChange={(value) => updateBase("historyCount", value)}
            />
            <NumberField
              label="会话缓存上限"
              hint="同时缓存的会话数量，超出后按最久未使用淘汰"
              value={settings.maxSessions}
              onChange={(value) => updateSettings("maxSessions", value)}
            />
            <NumberField
              label="回复后冷却（分钟）"
              value={settings.cooldownAfterReplyMs}
              msToMin
              onChange={(value) =>
                updateSettings("cooldownAfterReplyMs", value)
              }
            />
            <NumberField
              label="结构化历史保留（分钟）"
              value={settings.groupStructuredHistoryTtlMs}
              msToMin
              onChange={(value) =>
                updateSettings("groupStructuredHistoryTtlMs", value)
              }
            />
          </CardContent>
        </Card>
      ) : null}

      {mode === "runtime" ? (
        <Card>
          <CardHeader>
            <CardTitle>AI 请求限额</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <Field
              label="单用户 RPM"
              hint="同一个用户每分钟最多允许的 AI 请求次数"
            >
              <NumberInput
                min={0}
                value={settings.aiRequestLimits.userRpm}
                onValueChange={(value) => {
                  if (value === null) return;
                  setSettings((prev) => ({
                    ...prev,
                    aiRequestLimits: {
                      ...prev.aiRequestLimits,
                      userRpm: value,
                    },
                  }));
                }}
              />
            </Field>
            <Field
              label="单群 RPM"
              hint="同一个群每分钟最多允许的 AI 请求次数，群内所有成员共享这个额度"
            >
              <NumberInput
                min={0}
                value={settings.aiRequestLimits.groupRpm}
                onValueChange={(value) => {
                  if (value === null) return;
                  setSettings((prev) => ({
                    ...prev,
                    aiRequestLimits: {
                      ...prev.aiRequestLimits,
                      groupRpm: value,
                    },
                  }));
                }}
              />
            </Field>
            <NumberField
              label="限额窗口（秒）"
              value={settings.aiRequestLimits.windowMs}
              msToSec
              onChange={(value) =>
                setSettings((prev) => ({
                  ...prev,
                  aiRequestLimits: {
                    ...prev.aiRequestLimits,
                    windowMs: value,
                  },
                }))
              }
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>
            {mode === "reply"
              ? "发送体验"
              : mode === "tools"
                ? "工具与输出开关"
                : "运行开关"}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {mode === "reply" ? (
            <>
              <ToggleField
                title="流式输出"
                description="逐步输出文本，而不是一次性整段返回"
                checked={settings.stream}
                onChange={(checked) => updateSettings("stream", checked)}
              />
              <ToggleField
                title="打字延迟"
                description="按内容长度模拟更自然的发送停顿"
                checked={settings.enableTypingDelay}
                onChange={(checked) =>
                  updateSettings("enableTypingDelay", checked)
                }
              />
            </>
          ) : null}
          {mode === "tools" ? (
            <>
              <ToggleField
                title="Markdown 截图"
                description="允许 AI 发送带主题和代码高亮的结构化内容截图"
                checked={settings.enableMarkdownScreenshot}
                onChange={(checked) =>
                  updateSettings("enableMarkdownScreenshot", checked)
                }
              />
              <ToggleField
                title="语音消息"
                description="允许 AI 合成并发送简短语音"
                checked={settings.audio.enabled}
                onChange={(checked) =>
                  setSettings((prev) => ({
                    ...prev,
                    audio: { ...prev.audio, enabled: checked },
                  }))
                }
              />
              <ToggleField
                title="外部 Skills"
                checked={settings.enableExternalSkills}
                onChange={(checked) =>
                  updateSettings("enableExternalSkills", checked)
                }
              />
            </>
          ) : null}
          {mode === "runtime" ? (
            <>
              <ToggleField
                title="调试日志"
                checked={settings.debug}
                onChange={(checked) => updateSettings("debug", checked)}
              />
              <ToggleField
                title="动态延迟"
                description="根据群聊活跃度延后回复，减少刷屏感"
                checked={settings.dynamicDelay.enabled}
                onChange={(checked) =>
                  setSettings((prev) => ({
                    ...prev,
                    dynamicDelay: { ...prev.dynamicDelay, enabled: checked },
                  }))
                }
              />
              <ToggleField
                title="忽略私聊"
                description="开启后 chat 插件忽略所有私聊消息"
                checked={base.ignorePrivateChat}
                onChange={(checked) => updateBase("ignorePrivateChat", checked)}
              />
            </>
          ) : null}
        </CardContent>
      </Card>

      {mode === "tools" ? (
        <Card>
          <CardHeader>
            <CardTitle>媒体与工具策略</CardTitle>
            <CardDescription>
              控制图片处理和非文本输出的使用频率
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="rounded-md border p-3 text-sm">
              <p className="font-medium">主模型读取图片</p>
              <p className="mt-1 text-xs text-muted-foreground">
                由视觉模型能力自动推断（当前：
                {base.isMultimodal ? "支持多模态" : "不支持/未绑定"}）
              </p>
            </div>
            <ToggleField
              title="聊天媒体识别"
              description="使用视觉角色模型生成图片和视频摘要"
              checked={base.enableMediaRecognition}
              onChange={(checked) =>
                updateBase("enableMediaRecognition", checked)
              }
            />
            <StrengthField
              label="工具调用倾向"
              value={settings.toolCallConstraintStrength}
              onChange={(value) =>
                updateSettings("toolCallConstraintStrength", value)
              }
            />
            <StrengthField
              label="语音使用倾向"
              value={settings.audioUsageConstraintStrength}
              onChange={(value) =>
                updateSettings("audioUsageConstraintStrength", value)
              }
            />
            <StrengthField
              label="Markdown 使用倾向"
              value={settings.markdownUsageConstraintStrength}
              onChange={(value) =>
                updateSettings("markdownUsageConstraintStrength", value)
              }
            />
          </CardContent>
        </Card>
      ) : null}

      {mode === "tools" ? (
        <Card>
          <CardHeader>
            <CardTitle>外部技能范围</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Toggle
              checked={settings.allowedExternalSkills.length === 0}
              onChange={setAllowAllExternalSkills}
              label="允许全部已注册 Skills"
            />

            {resources.skills.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                当前没有已注册的外部 Skills。
              </p>
            ) : (
              <div className="space-y-2">
                {resources.skills.map((skill) => {
                  const selected =
                    settings.allowedExternalSkills.length === 0 ||
                    settings.allowedExternalSkills.includes(skill);

                  return (
                    <label
                      key={skill}
                      className={cn(
                        "flex cursor-pointer items-center justify-between rounded-md border px-4 py-3 text-sm transition-colors",
                        selected
                          ? "border-primary/45 bg-secondary/35 text-foreground"
                          : "border-border/85 bg-card/78 text-muted-foreground hover:text-foreground",
                        settings.allowedExternalSkills.length === 0
                          ? "opacity-60"
                          : "",
                      )}
                    >
                      <span className="font-medium">{skill}</span>
                      <input
                        className="form-checkbox"
                        type="checkbox"
                        checked={selected}
                        disabled={settings.allowedExternalSkills.length === 0}
                        onChange={() => toggleAllowedExternalSkill(skill)}
                      />
                    </label>
                  );
                })}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              关闭“允许全部已注册 Skills”后，只加载下面勾选的外部 Skills
            </p>
          </CardContent>
        </Card>
      ) : null}

      {mode === "tools" ? (
        <Card>
          <CardHeader>
            <CardTitle>已加载工具资源</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <TagGroup
              title="Skills"
              emptyLabel="当前没有外部 Skills"
              items={resources.skills}
            />
            <TagGroup
              title="Tools"
              emptyLabel="当前没有注册 Tools"
              items={resources.tools}
            />
          </CardContent>
        </Card>
      ) : null}

      {mode === "runtime" ? (
        <Card>
          <CardHeader>
            <CardTitle>动态延迟参数</CardTitle>
            <CardDescription>控制活跃群聊中的回复延迟。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <Field label="互动窗口 (分钟)" hint="统计活跃度的时间范围">
              <NumberInput
                value={settings.dynamicDelay.interactionWindowMs / 60000}
                onValueChange={(value) => {
                  if (value === null) return;
                  setSettings((prev) => ({
                    ...prev,
                    dynamicDelay: {
                      ...prev.dynamicDelay,
                      interactionWindowMs: value * 60000,
                    },
                  }));
                }}
              />
            </Field>
            <Field
              label="基础延迟 (分钟)"
              hint="每增加一个互动人，额外增加的延迟"
            >
              <NumberInput
                value={settings.dynamicDelay.baseDelayMs / 60000}
                onValueChange={(value) => {
                  if (value === null) return;
                  setSettings((prev) => ({
                    ...prev,
                    dynamicDelay: {
                      ...prev.dynamicDelay,
                      baseDelayMs: value * 60000,
                    },
                  }));
                }}
              />
            </Field>
            <Field label="最大延迟 (分钟)" hint="再热闹也不会超过这个等待时间">
              <NumberInput
                value={settings.dynamicDelay.maxDelayMs / 60000}
                onValueChange={(value) => {
                  if (value === null) return;
                  setSettings((prev) => ({
                    ...prev,
                    dynamicDelay: {
                      ...prev.dynamicDelay,
                      maxDelayMs: value * 60000,
                    },
                  }));
                }}
              />
            </Field>
          </CardContent>
        </Card>
      ) : null}

      {mode === "runtime" ? (
        <Card>
          <CardHeader>
            <CardTitle>黑白名单</CardTitle>
            <CardDescription>
              支持按群号或用户号限制 chat 插件的触发范围
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <DatasourceMultiSelectField
              id="ai-group-whitelist"
              label="群聊白名单"
              description="非空时仅对白名单群生效"
              placeholder="点击选择群聊"
              source="qq_groups"
              options={groupOptions}
              value={settings.whitelistGroups}
              onChange={(value) => updateSettings("whitelistGroups", value)}
            />
            <DatasourceMultiSelectField
              id="ai-group-blacklist"
              label="群聊黑名单"
              description="命中后不回复"
              placeholder="点击选择群聊"
              source="qq_groups"
              options={groupOptions}
              value={settings.blacklistGroups}
              onChange={(value) => updateSettings("blacklistGroups", value)}
            />

            <Field
              label="媒体分析黑名单用户"
              hint="每行一个 QQ 号，这些人发的图片、视频、转发、卡片和群公告不会进入分析"
            >
              <Textarea
                className="min-h-32"
                value={arrayToLines(settings.mediaAnalysisBlacklistUsers)}
                onChange={(e) =>
                  updateSettings(
                    "mediaAnalysisBlacklistUsers",
                    linesToArray(e.target.value),
                  )
                }
              />
            </Field>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );

  const renderPersonaTab = () => (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1.5">
              <CardTitle className="flex items-center gap-2">
                <Ghost className="h-4 w-4 text-primary" />
                伪人模式
              </CardTitle>
              <CardDescription>
                使用强化的拟人提示词，让机器人更像混在群里的网友，而不是处理消息的客服。
              </CardDescription>
            </div>
            <Switch
              className="shrink-0"
              checked={pseudoHumanEnabled}
              onCheckedChange={(checked) =>
                setPersonalization((prev) => ({
                  ...prev,
                  pseudoHuman: { enabled: checked },
                }))
              }
            />
          </div>
        </CardHeader>
      </Card>

      <ThemePackSection
        title="回复风格主题包"
        description="人设与说话风格一起切换；选择后立即生效。内置主题包只能复制后修改。"
        themes={themes.reply}
        selectedId={personalization.replyStyleTheme}
        editing={editingReplyTheme}
        onSelect={(id) => void applyThemeSelection("reply", id)}
        onEdit={() => setEditingReplyTheme((prev) => !prev)}
        onCreate={(name) => void createReplyTheme(name)}
        onFork={(name) => void forkReplyTheme(name)}
        onRename={(name) => void renameTheme("reply", name)}
        onDelete={() => void deleteTheme("reply")}
      />

      {editingReplyTheme ? (
        <Card>
          <CardHeader>
            <CardTitle>核心人设</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="角色设定" hint="直接写给模型的人设说明">
              <Textarea
                className="min-h-48"
                disabled={replyThemeLocked}
                value={personalization.persona}
                onChange={(e) =>
                  setPersonalization((prev) => ({
                    ...prev,
                    persona: e.target.value,
                  }))
                }
              />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="基础说话风格" hint="长期稳定生效的语气说明">
                <Textarea
                  className="min-h-32"
                  disabled={replyThemeLocked}
                  value={personalization.replyStyle.baseStyle}
                  onChange={(e) =>
                    setPersonalization((prev) => ({
                      ...prev,
                      replyStyle: {
                        ...prev.replyStyle,
                        baseStyle: e.target.value,
                      },
                    }))
                  }
                />
              </Field>
              <Field label="切换风格概率" hint="0 到 1，默认 0.2">
                <NumberInput
                  step="0.01"
                  disabled={replyThemeLocked}
                  value={personalization.replyStyle.multipleProbability}
                  onValueChange={(value) => {
                    if (value === null) return;
                    setPersonalization((prev) => ({
                      ...prev,
                      replyStyle: {
                        ...prev.replyStyle,
                        multipleProbability: value,
                      },
                    }));
                  }}
                />
              </Field>
            </div>
            <Field label="可切换风格" hint="每行一个临时风格，会按概率混入回复">
              <Textarea
                className="min-h-48"
                disabled={replyThemeLocked}
                value={arrayToLines(personalization.replyStyle.multipleStyles)}
                onChange={(e) =>
                  setPersonalization((prev) => ({
                    ...prev,
                    replyStyle: {
                      ...prev.replyStyle,
                      multipleStyles: linesToArray(e.target.value),
                    },
                  }))
                }
              />
            </Field>
          </CardContent>
        </Card>
      ) : null}

      <ThemePackSection
        title="情绪主题包"
        description={
          pseudoHumanEnabled
            ? "默认情绪、刷新间隔与各情绪参考发言一起切换；伪人模式下不生效。"
            : "默认情绪、刷新间隔与各情绪参考发言一起切换；选择后立即生效。"
        }
        themes={themes.emotion}
        selectedId={personalization.emotionTheme}
        editing={editingEmotionTheme}
        onSelect={(id) => void applyThemeSelection("emotion", id)}
        onEdit={() => setEditingEmotionTheme((prev) => !prev)}
        onCreate={(name) => void createEmotionTheme(name)}
        onFork={(name) => void forkEmotionTheme(name)}
        onRename={(name) => void renameTheme("emotion", name)}
        onDelete={() => void deleteTheme("emotion")}
      />

      {editingEmotionTheme ? (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>
                  情绪系统
                  {pseudoHumanEnabled ? (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      伪人模式下已停用
                    </span>
                  ) : null}
                </CardTitle>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={emotionDisabled}
                onClick={addEmotion}
              >
                <Plus className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">添加情绪</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="默认情绪" hint="参考发言为空时也会回退到默认情绪">
                <SelectField
                  value={personalization.emotion.defaultEmotion}
                  disabled={emotionDisabled}
                  onChange={(value) =>
                    setPersonalization((prev) => ({
                      ...prev,
                      emotion: { ...prev.emotion, defaultEmotion: value },
                    }))
                  }
                  options={emotionOptions.map((emotionName) => ({
                    label: emotionName,
                    value: emotionName,
                  }))}
                />
              </Field>
              <Field
                label="情绪更新间隔 (分钟)"
                hint="超过这个时间后，下次聊天将刷新情绪"
              >
                <NumberInput
                  min={1}
                  disabled={emotionDisabled}
                  value={Math.round(
                    personalization.emotion.updateIntervalMs / 60000,
                  )}
                  onValueChange={(value) => {
                    if (value === null) return;
                    setPersonalization((prev) => ({
                      ...prev,
                      emotion: {
                        ...prev.emotion,
                        updateIntervalMs: value * 60000,
                      },
                    }));
                  }}
                />
              </Field>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {Object.entries(personalization.emotion.emotions).map(
                ([emotionName, entry], index) => (
                  <EmotionEditorCard
                    key={`emotion-${index}-${emotionName}`}
                    disabled={emotionDisabled}
                    emotionName={emotionName}
                    examples={entry.examples}
                    isDefault={
                      emotionName === personalization.emotion.defaultEmotion
                    }
                    onRename={(nextName) =>
                      renameEmotion(emotionName, nextName)
                    }
                    onRemove={() => removeEmotion(emotionName)}
                    onExamplesChange={(examples) =>
                      updateEmotionExamples(emotionName, examples)
                    }
                  />
                ),
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );

  const renderCapabilityTab = (mode: "context" | "tools") => (
    <div className="space-y-4">
      {mode === "context" ? (
        <Card>
          <CardHeader>
            <CardTitle>话题背景</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <CapabilityCard
              title="Topic"
              description="按固定时间窗口归纳群友历史话题，作为当前可见历史之外的背景参考"
              enabled={personalization.topic.enabled}
              onEnabledChange={(checked) =>
                setPersonalization((prev) => ({
                  ...prev,
                  topic: { ...prev.topic, enabled: checked },
                }))
              }
            >
              <NumberField
                label="窗口时长 (小时)"
                value={personalization.topic.windowHours}
                onChange={(value) =>
                  setPersonalization((prev) => ({
                    ...prev,
                    topic: { ...prev.topic, windowHours: value },
                  }))
                }
              />
              <NumberField
                label="回填窗口数"
                value={personalization.topic.historyWindowCount}
                onChange={(value) =>
                  setPersonalization((prev) => ({
                    ...prev,
                    topic: { ...prev.topic, historyWindowCount: value },
                  }))
                }
              />
            </CapabilityCard>
          </CardContent>
        </Card>
      ) : null}

      {mode === "context" ? (
        <Card>
          <CardHeader>
            <CardTitle>表达样本</CardTitle>
          </CardHeader>
          <CardContent>
            <CapabilityCard
              title="Expression"
              description="把该用户最近说过的原话抽几条注入"
              enabled={personalization.expression.enabled}
              onEnabledChange={(checked) =>
                setPersonalization((prev) => ({
                  ...prev,
                  expression: { ...prev.expression, enabled: checked },
                }))
              }
            >
              <NumberField
                label="回看消息条数"
                value={personalization.expression.lookbackMessages}
                onChange={(value) =>
                  setPersonalization((prev) => ({
                    ...prev,
                    expression: {
                      ...prev.expression,
                      lookbackMessages: value,
                    },
                  }))
                }
              />
              <NumberField
                label="最大注入条数"
                value={personalization.expression.sampleSize}
                onChange={(value) =>
                  setPersonalization((prev) => ({
                    ...prev,
                    expression: { ...prev.expression, sampleSize: value },
                  }))
                }
              />
            </CapabilityCard>
          </CardContent>
        </Card>
      ) : null}

      {mode === "tools" ? (
        <Card>
          <CardHeader>
            <CardTitle>外部能力</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 xl:grid-cols-2">
            <CapabilityCard
              title="SearXNG 搜索"
              description="允许 bot 主动搜索网页"
              enabled={settings.searxng.enabled}
              onEnabledChange={(checked) =>
                setSettings((prev) => ({
                  ...prev,
                  searxng: { ...prev.searxng, enabled: checked },
                }))
              }
            >
              <Field label="搜索地址" hint="你的 SearXNG 服务地址">
                <Input
                  value={settings.searxng.baseUrl}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      searxng: { ...prev.searxng, baseUrl: e.target.value },
                    }))
                  }
                  placeholder="https://search.example.com"
                />
              </Field>
              <NumberField
                label="超时 (秒)"
                value={settings.searxng.timeoutMs}
                msToSec={true}
                onChange={(value) =>
                  setSettings((prev) => ({
                    ...prev,
                    searxng: { ...prev.searxng, timeoutMs: value },
                  }))
                }
              />
              <NumberField
                label="默认结果数"
                value={settings.searxng.defaultLimit}
                onChange={(value) =>
                  setSettings((prev) => ({
                    ...prev,
                    searxng: { ...prev.searxng, defaultLimit: value },
                  }))
                }
              />
              <NumberField
                label="最大结果数"
                value={settings.searxng.maxLimit}
                onChange={(value) =>
                  setSettings((prev) => ({
                    ...prev,
                    searxng: { ...prev.searxng, maxLimit: value },
                  }))
                }
              />
              <NumberField
                label="最大搜索次数"
                value={settings.searxng.maxSearchCount}
                onChange={(value) =>
                  setSettings((prev) => ({
                    ...prev,
                    searxng: { ...prev.searxng, maxSearchCount: value },
                  }))
                }
              />
            </CapabilityCard>
            <CapabilityCard
              title="网页阅读器"
              description="抓取网页内容，让模型读取页面再总结"
              enabled={settings.webReader.enabled}
              onEnabledChange={(checked) =>
                setSettings((prev) => ({
                  ...prev,
                  webReader: { ...prev.webReader, enabled: checked },
                }))
              }
            >
              <Toggle
                checked={settings.webReader.useWorkingModel}
                onChange={(checked) =>
                  setSettings((prev) => ({
                    ...prev,
                    webReader: { ...prev.webReader, useWorkingModel: checked },
                  }))
                }
                label="使用工作模型概括总结"
              />
              <NumberField
                label="读取超时 (秒)"
                value={settings.webReader.timeoutMs}
                msToSec={true}
                onChange={(value) =>
                  setSettings((prev) => ({
                    ...prev,
                    webReader: { ...prev.webReader, timeoutMs: value },
                  }))
                }
              />
              <NumberField
                label="浏览器超时 (秒)"
                value={settings.webReader.browserTimeoutMs}
                msToSec={true}
                onChange={(value) =>
                  setSettings((prev) => ({
                    ...prev,
                    webReader: { ...prev.webReader, browserTimeoutMs: value },
                  }))
                }
              />
              <NumberField
                label="最大 HTML 字节数"
                value={settings.webReader.maxHtmlBytes}
                onChange={(value) =>
                  setSettings((prev) => ({
                    ...prev,
                    webReader: { ...prev.webReader, maxHtmlBytes: value },
                  }))
                }
              />
              <NumberField
                label="最大提取字符数"
                value={settings.webReader.maxExtractedChars}
                onChange={(value) =>
                  setSettings((prev) => ({
                    ...prev,
                    webReader: { ...prev.webReader, maxExtractedChars: value },
                  }))
                }
              />
              <Field label="允许的内容类型" hint="每行一个 MIME 类型">
                <Textarea
                  className="min-h-24"
                  value={arrayToLines(settings.webReader.allowedContentTypes)}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      webReader: {
                        ...prev.webReader,
                        allowedContentTypes: linesToArray(e.target.value),
                      },
                    }))
                  }
                />
              </Field>
            </CapabilityCard>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );

  const updateMemory = <K extends keyof MemoryConfig>(
    key: K,
    value: MemoryConfig[K],
  ) => {
    setMemory((prev) => ({ ...prev, [key]: value }));
  };

  const renderMemoryTab = () => (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>长期记忆</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <ToggleField
            title="启用群聊记忆"
            description=""
            checked={memory.enabled}
            onChange={(checked) => updateMemory("enabled", checked)}
          />
          <Field label="抽取模型">
            <SelectField
              value={memory.extractModel}
              onChange={(value) =>
                updateMemory(
                  "extractModel",
                  value === "main" ? "main" : "working",
                )
              }
              options={[
                { value: "working", label: "工作模型（推荐）" },
                { value: "main", label: "主模型" },
              ]}
            />
          </Field>
          <NumberField
            label="记忆保留时长（月）"
            hint=""
            value={memory.retentionMonths}
            onChange={(value) => updateMemory("retentionMonths", value)}
          />
          <NumberField
            label="每群记忆上限（条）"
            hint="超出后按「重要性低、时间旧」淘汰"
            value={memory.maxItemsPerGroup}
            onChange={(value) => updateMemory("maxItemsPerGroup", value)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>抽取节奏</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <NumberField
            label="抽取窗口（分钟）"
            hint=""
            value={memory.windowMinutes}
            onChange={(value) => updateMemory("windowMinutes", value)}
          />
          <NumberField
            label="每次至少多少条消息"
            hint=""
            value={memory.minMessagesPerWindow}
            onChange={(value) => updateMemory("minMessagesPerWindow", value)}
          />
          <NumberField
            label="最低置信度"
            hint="0~1。调高更保守，调低更容易记错"
            value={memory.minConfidence}
            onChange={(value) => updateMemory("minConfidence", value)}
            step="0.05"
          />
          <NumberField
            label="单次送入的字符上限"
            hint="越小越快、越省，但可能漏掉长消息"
            value={memory.maxCharsPerWindow}
            onChange={(value) => updateMemory("maxCharsPerWindow", value)}
          />
          <NumberField
            label="单群缓冲上限（条）"
            hint=""
            value={memory.maxBufferMessages}
            onChange={(value) => updateMemory("maxBufferMessages", value)}
          />
          <NumberField
            label="检查间隔（秒）"
            hint=""
            value={Math.round(memory.extractIntervalMs / 1000)}
            onChange={(value) =>
              updateMemory("extractIntervalMs", value * 1000)
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>注入</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <NumberField
            label="每轮注入条数"
            value={memory.injectTopK}
            onChange={(value) => updateMemory("injectTopK", value)}
          />
          <NumberField
            label="注入块字符上限"
            value={memory.injectMaxChars}
            onChange={(value) => updateMemory("injectMaxChars", value)}
          />
          <NumberField
            label="检索超时（毫秒）"
            value={memory.injectTimeoutMs}
            onChange={(value) => updateMemory("injectTimeoutMs", value)}
          />
          <NumberField
            label="注入缓存（秒）"
            hint="同一条消息触发多轮时复用检索结果，0 表示不缓存"
            value={Math.round(memory.cacheTtlMs / 1000)}
            onChange={(value) => updateMemory("cacheTtlMs", value * 1000)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>群员画像</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <ToggleField
            title="启用群员画像"
            checked={memory.profileEnabled}
            onChange={(checked) => updateMemory("profileEnabled", checked)}
          />
          <NumberField
            label="每积累多少条发言重画一次"
            value={memory.profileUpdateEvery}
            onChange={(value) => updateMemory("profileUpdateEvery", value)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>资料查找</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <ToggleField
            title="允许模型主动查资料"
            checked={memory.recallToolsEnabled}
            onChange={(checked) => updateMemory("recallToolsEnabled", checked)}
          />
          <NumberField
            label="每轮工具调用上限"
            value={memory.recallToolBudget}
            onChange={(value) => updateMemory("recallToolBudget", value)}
          />
          <NumberField
            label="默认回溯天数"
            hint="模型不指定天数时往回查多久"
            value={memory.contextLookbackDays}
            onChange={(value) => updateMemory("contextLookbackDays", value)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>原文索引与原话</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <ToggleField
            title="原文消息也入向量库"
            description="每条有信息量的群消息都做一次本地向量化，检索随历史变慢"
            checked={memory.indexMessages}
            onChange={(checked) => updateMemory("indexMessages", checked)}
          />
          <NumberField
            label="入向量的最短消息长度"
            hint="太短的复读、表情会被跳过"
            value={memory.indexMessageMinChars}
            onChange={(value) => updateMemory("indexMessageMinChars", value)}
          />
          <NumberField
            label="原文索引保留天数"
            hint="原文向量只当热数据"
            value={memory.indexMessageRetentionDays}
            onChange={(value) =>
              updateMemory("indexMessageRetentionDays", value)
            }
          />
          <ToggleField
            title="记忆附带原话"
            description="抽取时保存说话原话，命中记忆时一起给模型"
            checked={memory.sourceTraceback}
            onChange={(checked) => updateMemory("sourceTraceback", checked)}
          />
          <NumberField
            label="每次回查几条原文"
            value={memory.sourceTracebackLimit}
            onChange={(value) => updateMemory("sourceTracebackLimit", value)}
          />
        </CardContent>
      </Card>
    </div>
  );

  const renderStickerTab = () => (
    <Card>
      <CardHeader className="border-b">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>表情包管理</CardTitle>
            <CardDescription className="mt-1">
              选择文字模型可用于匹配的本地表情标签
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {personalization.emoji.enabled ? "已启用" : "已关闭"}
            </span>
            <Switch
              checked={personalization.emoji.enabled}
              onCheckedChange={(checked) =>
                setPersonalization((prev) => ({
                  ...prev,
                  emoji: { ...prev.emoji, enabled: checked },
                }))
              }
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-5">
        <div className="max-w-sm">
          <StrengthField
            label="使用倾向"
            value={settings.emojiUsageConstraintStrength}
            onChange={(value) =>
              updateSettings("emojiUsageConstraintStrength", value)
            }
          />
        </div>
        <StickerPicker
          options={stickerOptions}
          characters={personalization.emoji.characters}
          stickers={personalization.emoji.stickers}
          disabled={!personalization.emoji.enabled}
          onCharactersChange={(characters) =>
            setPersonalization((prev) => ({
              ...prev,
              emoji: { ...prev.emoji, characters },
            }))
          }
          onStickersChange={(stickers) =>
            setPersonalization((prev) => ({
              ...prev,
              emoji: { ...prev.emoji, stickers },
            }))
          }
        />
      </CardContent>
    </Card>
  );

  return (
    <div className="ai-config-page mx-auto w-full max-w-6xl space-y-5 [&_.panel-glow]:rounded-md [&_.panel-glow]:shadow-none">
      <nav aria-label="AI 设置分类" className="overflow-x-auto border-b">
        <div className="flex min-w-max items-end gap-1">
          {configTabs.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => setActiveTab(id)}
                className={cn(
                  "flex h-11 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-[border-color,color,background-color,transform] duration-150 active:scale-[0.98]",
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            );
          })}
        </div>
      </nav>

      {loading ? (
        <div className="border-y py-10 text-center text-sm text-muted-foreground">
          正在加载 AI 配置...
        </div>
      ) : null}

      {!loading && activeTab === "model" ? renderModelTab() : null}
      {!loading && activeTab === "reply" ? (
        <div className="space-y-4">
          {renderPersonaTab()}
          {renderBehaviorTab("reply")}
        </div>
      ) : null}
      {!loading && activeTab === "context"
        ? renderCapabilityTab("context")
        : null}
      {!loading && activeTab === "tools" ? (
        <div className="space-y-4">
          {renderBehaviorTab("tools")}
          {renderCapabilityTab("tools")}
        </div>
      ) : null}
      {!loading && activeTab === "runtime"
        ? renderBehaviorTab("runtime")
        : null}
      {!loading && activeTab === "memory" ? renderMemoryTab() : null}
      {!loading && activeTab === "stickers" ? renderStickerTab() : null}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <p className="text-sm font-medium">{label}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 border-y px-1 py-3 text-sm">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

function ToggleField({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="h-full min-h-20 border-b py-3 first:pt-0 last:border-b-0 last:pb-0">
      <label className="flex h-full min-h-14 cursor-pointer items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          {description ? (
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <Switch
          className="shrink-0"
          checked={checked}
          onCheckedChange={onChange}
        />
      </label>
    </div>
  );
}

function NumberField({
  label,
  hint,
  value,
  onChange,
  step,
  msToMin,
  msToSec,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (value: number) => void;
  step?: string;
  msToMin?: boolean;
  msToSec?: boolean;
}) {
  let displayValue = value;
  if (msToMin) displayValue = Math.round(value / 60000);
  if (msToSec) displayValue = Math.round(value / 1000);

  const handleChange = (val: number) => {
    if (msToMin) onChange(val * 60000);
    else if (msToSec) onChange(val * 1000);
    else onChange(val);
  };

  return (
    <Field label={label} hint={hint}>
      <NumberInput
        step={step}
        value={displayValue}
        onValueChange={(value) => {
          if (value !== null) handleChange(value);
        }}
      />
    </Field>
  );
}

function StrengthField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Strength;
  onChange: (value: Strength) => void;
}) {
  return (
    <Field label={label}>
      <SelectField
        value={value}
        onChange={(nextValue) => onChange(nextValue as Strength)}
        options={[
          { label: "低", value: "low" },
          { label: "中", value: "medium" },
          { label: "高", value: "high" },
        ]}
      />
    </Field>
  );
}

function SelectField({
  value,
  onChange,
  options,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="请选择" />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CapabilityCard({
  title,
  description,
  enabled,
  onEnabledChange,
  children,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "space-y-4 border-l-2 px-4 py-1",
        enabled ? "border-primary" : "border-border",
      )}
    >
      <label className="flex min-h-16 cursor-pointer items-center justify-between gap-4">
        <div>
          <p className="text-base font-semibold">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <Switch
          className="shrink-0"
          checked={enabled}
          onCheckedChange={onEnabledChange}
        />
      </label>
      <div className={cn("space-y-3", !enabled && "opacity-55")}>
        {children}
      </div>
    </section>
  );
}

function TagGroup({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: string[];
  emptyLabel: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <span
              key={item}
              className="rounded-md bg-secondary px-3 py-1 text-xs text-secondary-foreground"
            >
              {item}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function EmotionEditorCard({
  emotionName,
  examples,
  isDefault,
  disabled,
  onRename,
  onRemove,
  onExamplesChange,
}: {
  emotionName: string;
  examples: string[];
  isDefault: boolean;
  disabled?: boolean;
  onRename: (nextName: string) => void;
  onRemove: () => void;
  onExamplesChange: (examples: string[]) => void;
}) {
  const [nameDraft, setNameDraft] = useState(emotionName);

  useEffect(() => {
    setNameDraft(emotionName);
  }, [emotionName]);

  const commitRename = () => {
    if (disabled) return;
    const trimmed = nameDraft.trim().toLowerCase();
    if (trimmed === emotionName) {
      setNameDraft(emotionName);
      return;
    }
    if (!trimmed) {
      setNameDraft(emotionName);
      return;
    }
    onRename(trimmed);
  };

  return (
    <div className="border-l-2 border-border px-4 py-1">
      <div className="mb-3 flex items-center gap-2">
        <Input
          value={nameDraft}
          disabled={disabled}
          onChange={(event) => setNameDraft(event.target.value)}
          onBlur={commitRename}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitRename();
            } else if (event.key === "Escape") {
              setNameDraft(emotionName);
            }
          }}
          aria-label="情绪名称"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isDefault || disabled}
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <Field label="角色发言参考" hint="模型会模仿参考语气">
        <Textarea
          className="min-h-32"
          disabled={disabled}
          value={arrayToLines(examples)}
          onChange={(event) =>
            onExamplesChange(linesToArray(event.target.value))
          }
        />
      </Field>
    </div>
  );
}
