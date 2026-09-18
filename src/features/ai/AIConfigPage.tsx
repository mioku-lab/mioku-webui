import { useEffect, useRef, useState } from "react";
import {
  Bot,
  BrainCircuit,
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

type Strength = "low" | "medium" | "high";

type BaseConfig = {
  apiUrl?: string;
  apiKey?: string;
  model?: string;
  workingModel?: string;
  multimodalWorkingModel?: string;
  isMultimodal?: boolean;
  enableMediaRecognition: boolean;
  temperature: number;
  historyCount: number;
  maxIterations: number;
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
  emotion: EmotionConfig;
  replyStyle: {
    baseStyle: string;
    multipleStyles: string[];
    multipleProbability: number;
  };
  memory: {
    enabled: boolean;
    groupHistoryLimit: number;
    userHistoryLimit: number;
  };
  topic: {
    enabled: boolean;
    windowHours: number;
    historyWindowCount: number;
  };
  planner: {
    enabled: boolean;
    idleThresholdMs: number;
    idleMessageCount: number;
    idleCheckBotIds: string[];
  };
  emoji: {
    enabled: boolean;
    characters: string[];
    stickers: string[];
  };
  expression: {
    enabled: boolean;
    learnAfterMessages: number;
    sampleSize: number;
  };
};

type AIResources = {
  instances: string[];
  skills: string[];
  tools: string[];
};

type ConfigTab =
  | "model"
  | "reply"
  | "context"
  | "tools"
  | "runtime"
  | "stickers";

const configTabs = [
  { id: "model", label: "提供商与模型", icon: BrainCircuit },
  { id: "reply", label: "回复与角色", icon: MessageSquareText },
  { id: "context", label: "上下文与主动性", icon: Bot },
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
  temperature: 0.8,
  historyCount: 100,
  maxIterations: 20,
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
  memory: {
    enabled: true,
    groupHistoryLimit: 300,
    userHistoryLimit: 100,
  },
  topic: {
    enabled: true,
    windowHours: 5,
    historyWindowCount: 3,
  },
  planner: {
    enabled: true,
    idleThresholdMs: 1800000,
    idleMessageCount: 100,
    idleCheckBotIds: [],
  },
  emoji: {
    enabled: false,
    characters: [],
    stickers: [],
  },
  expression: {
    enabled: true,
    learnAfterMessages: 100,
    sampleSize: 8,
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
    emotion: normalizeEmotionConfig(personalization.emotion),
    replyStyle: {
      ...personalization.replyStyle,
      multipleStyles: compactLineArray(
        personalization.replyStyle.multipleStyles,
      ),
    },
    planner: {
      ...personalization.planner,
      idleCheckBotIds: compactLineArray(
        personalization.planner.idleCheckBotIds,
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

  const load = async () => {
    setLoading(true);
    try {
      const [
        baseRes,
        personalizationRes,
        settingsRes,
        instancesRes,
        skillsRes,
        groupsRes,
        stickersRes,
      ] = await Promise.all([
        apiFetch<{ data: BaseConfig }>("/api/ai/base"),
        apiFetch<{ data: PersonalizationConfig }>("/api/ai/personalization"),
        apiFetch<{ data: SettingsConfig }>("/api/ai/settings"),
        apiFetch<{ data: Array<string | { name: string }> }>("/api/ai/instances"),
        apiFetch<{ data: { skills: string[]; tools: string[] } }>(
          "/api/ai/skills",
        ),
        apiFetch<{ data: DatasourceOption[] }>(
          "/api/plugin-config/datasources/qq_groups",
        ),
        apiFetch<{ data: StickerOption[] }>("/api/ai/stickers").catch(() => ({
          data: [],
        })),
      ]);

      const nextBase = { ...emptyBaseConfig, ...(baseRes.data || {}) };
      const rawExpression = (personalizationRes.data?.expression || {}) as {
        enabled?: boolean;
        sampleSize?: number;
        learnAfterMessages?: number;
        maxExpressions?: number;
      };
      const nextPersonalization = {
        ...emptyPersonalizationConfig,
        ...(personalizationRes.data || {}),
        persona: normalizeEscapedNewlines(
          personalizationRes.data?.persona || "",
        ),
        emotion: normalizeEmotionConfig(
          (personalizationRes.data as Partial<PersonalizationConfig>)?.emotion,
        ),
        replyStyle: {
          ...emptyPersonalizationConfig.replyStyle,
          ...(personalizationRes.data?.replyStyle || {}),
          baseStyle: normalizeEscapedNewlines(
            personalizationRes.data?.replyStyle?.baseStyle || "",
          ),
        },
        memory: {
          ...emptyPersonalizationConfig.memory,
          ...(personalizationRes.data?.memory || {}),
        },
        topic: {
          ...emptyPersonalizationConfig.topic,
          ...(personalizationRes.data?.topic || {}),
        },
        planner: {
          ...emptyPersonalizationConfig.planner,
          ...(personalizationRes.data?.planner || {}),
        },
        emoji: {
          ...emptyPersonalizationConfig.emoji,
          ...(personalizationRes.data?.emoji || {}),
          characters: compactLineArray(
            personalizationRes.data?.emoji?.characters,
          ),
          stickers: compactLineArray(personalizationRes.data?.emoji?.stickers),
        },
        expression: {
          ...emptyPersonalizationConfig.expression,
          ...rawExpression,
          learnAfterMessages:
            rawExpression.learnAfterMessages ??
            rawExpression.maxExpressions ??
            emptyPersonalizationConfig.expression.learnAfterMessages,
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

      initialSnapshotRef.current = JSON.stringify({
        base: nextBase,
        personalization: nextPersonalization,
        settings: nextSettings,
      });
      setHasChanges(false);
    } finally {
      setLoading(false);
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
    });
    setHasChanges(
      initialSnapshotRef.current.length > 0 &&
        currentSnapshot !== initialSnapshotRef.current,
    );
  }, [base, personalization, settings]);

  async function saveAll() {
    setSaving(true);
    try {
      const nextSettings = sanitizeSettingsForSave(settings);
      const nextPersonalization =
        sanitizePersonalizationForSave(personalization);
      const basePayload = {
        enableMediaRecognition: base.enableMediaRecognition,
        temperature: base.temperature,
        historyCount: base.historyCount,
        maxIterations: base.maxIterations,
      };
      await Promise.all([
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
      ]);
      setPersonalization(nextPersonalization);
      setSettings(nextSettings);
      initialSnapshotRef.current = JSON.stringify({
        base,
        personalization: nextPersonalization,
        settings: nextSettings,
      });
      setHasChanges(false);
      toast.success("设置已保存~");
    } finally {
      setSaving(false);
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

  const renderModelTab = () => (
    <ProvidersModelsTab
      temperature={base.temperature}
      maxIterations={base.maxIterations}
      onBaseChange={(patch) => {
        setBase((prev) => ({ ...prev, ...patch }));
      }}
    />
  );

  const renderBehaviorTab = (mode: "reply" | "tools" | "runtime") => (
    <div className="space-y-4">
      {mode === "reply" ? (
        <Card>
          <CardHeader>
            <CardTitle>回复体验</CardTitle>
            <CardDescription>
              控制 chat 插件怎么回、多久回、是否展示流式输出和打字停顿。
            </CardDescription>
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
            <CardDescription>
              限制 chat 插件每分钟可实际发起的总 AI 请求次数
            </CardDescription>
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
                description="按内容长度模拟更自然的发送停顿；实际总等待时间还会受累计上限控制"
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
                description="允许 AI 合成并发送简短语音；接口地址、密钥与超时由 audio 服务配置页管理"
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
                description="允许调用额外注册的技能扩展"
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
                description="打开后会输出更多运行时细节"
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
            <CardTitle>外部 Skills 范围</CardTitle>
            <CardDescription>
              控制 chat 插件通过外部 Skills
              能加载哪些扩展能力。留空表示允许全部已注册
              Skills；如果想全部禁用，直接关闭上面的“外部 Skills”开关。
            </CardDescription>
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
              关闭“允许全部已注册 Skills”后，AI 只能看到并加载下面勾选的外部
              Skills。
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
            <CardDescription>
              用于控制 bot 在热闹群里的“等一等再说”的策略
            </CardDescription>
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
          <CardTitle>核心人设</CardTitle>
          <CardDescription>
            决定 bot 是谁、说话像谁。这里是最影响整体风格的部分
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="角色设定" hint="直接写给模型的人设说明">
            <Textarea
              className="min-h-48"
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
            <Field label="切换风格概率" hint="0 到 1 之间">
              <NumberInput
                step="0.01"
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

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>情绪系统</CardTitle>
              <CardDescription>决定 bot 当前情绪</CardDescription>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
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
                  emotionName={emotionName}
                  examples={entry.examples}
                  isDefault={
                    emotionName === personalization.emotion.defaultEmotion
                  }
                  onRename={(nextName) => renameEmotion(emotionName, nextName)}
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
    </div>
  );

  const renderCapabilityTab = (mode: "context" | "tools") => (
    <div className="space-y-4">
      {mode === "context" ? (
        <Card>
          <CardHeader>
            <CardTitle>记忆与话题</CardTitle>
            <CardDescription>
              这些能力决定 bot 是否会记住上下文、提炼话题，并在群冷场时主动说话
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <CapabilityCard
              title="Memory"
              description="主模型按需调用回忆工具，工作模型检索历史记录"
              enabled={personalization.memory.enabled}
              onEnabledChange={(checked) =>
                setPersonalization((prev) => ({
                  ...prev,
                  memory: { ...prev.memory, enabled: checked },
                }))
              }
            >
              <NumberField
                label="群聊回忆条数"
                value={personalization.memory.groupHistoryLimit}
                onChange={(value) =>
                  setPersonalization((prev) => ({
                    ...prev,
                    memory: { ...prev.memory, groupHistoryLimit: value },
                  }))
                }
              />
              <NumberField
                label="用户历史条数"
                value={personalization.memory.userHistoryLimit}
                onChange={(value) =>
                  setPersonalization((prev) => ({
                    ...prev,
                    memory: { ...prev.memory, userHistoryLimit: value },
                  }))
                }
              />
            </CapabilityCard>
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
            <CapabilityCard
              title="Planner"
              description="在群聊冷场时判断是否主动插话"
              enabled={personalization.planner.enabled}
              onEnabledChange={(checked) =>
                setPersonalization((prev) => ({
                  ...prev,
                  planner: { ...prev.planner, enabled: checked },
                }))
              }
            >
              <NumberField
                label="空闲阈值 (分钟)"
                value={personalization.planner.idleThresholdMs}
                msToMin={true}
                onChange={(value) =>
                  setPersonalization((prev) => ({
                    ...prev,
                    planner: { ...prev.planner, idleThresholdMs: value },
                  }))
                }
              />
              <NumberField
                label="最少消息数"
                value={personalization.planner.idleMessageCount}
                onChange={(value) =>
                  setPersonalization((prev) => ({
                    ...prev,
                    planner: { ...prev.planner, idleMessageCount: value },
                  }))
                }
              />
              <Field
                label="空闲检查 bot ID"
                hint="每行一个；留空时使用全部 bot"
              >
                <Textarea
                  className="min-h-24"
                  value={arrayToLines(personalization.planner.idleCheckBotIds)}
                  onChange={(e) =>
                    setPersonalization((prev) => ({
                      ...prev,
                      planner: {
                        ...prev.planner,
                        idleCheckBotIds: linesToArray(e.target.value),
                      },
                    }))
                  }
                />
              </Field>
            </CapabilityCard>
          </CardContent>
        </Card>
      ) : null}

      {mode === "context" ? (
        <Card>
          <CardHeader>
            <CardTitle>表达学习</CardTitle>
            <CardDescription>按用户积累表达习惯并注入当前回复</CardDescription>
          </CardHeader>
          <CardContent>
            <CapabilityCard
              title="Expression"
              description="按用户学习表达习惯，在该用户触发对话时注入供回复参考"
              enabled={personalization.expression.enabled}
              onEnabledChange={(checked) =>
                setPersonalization((prev) => ({
                  ...prev,
                  expression: { ...prev.expression, enabled: checked },
                }))
              }
            >
              <NumberField
                label="单用户触发阈值（消息数）"
                value={personalization.expression.learnAfterMessages}
                onChange={(value) =>
                  setPersonalization((prev) => ({
                    ...prev,
                    expression: {
                      ...prev.expression,
                      learnAfterMessages: value,
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
            <CardDescription>
              搜索和网页阅读属于高影响能力，建议先按需打开，再配置超时和内容限制
            </CardDescription>
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
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="h-full min-h-20 border-b py-3 first:pt-0 last:border-b-0 last:pb-0">
      <label className="flex h-full min-h-14 cursor-pointer items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
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
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
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
  onRename,
  onRemove,
  onExamplesChange,
}: {
  emotionName: string;
  examples: string[];
  isDefault: boolean;
  onRename: (nextName: string) => void;
  onRemove: () => void;
  onExamplesChange: (examples: string[]) => void;
}) {
  const [nameDraft, setNameDraft] = useState(emotionName);

  useEffect(() => {
    setNameDraft(emotionName);
  }, [emotionName]);

  const commitRename = () => {
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
          disabled={isDefault}
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <Field label="角色发言参考" hint="模型会模仿参考语气">
        <Textarea
          className="min-h-32"
          value={arrayToLines(examples)}
          onChange={(event) =>
            onExamplesChange(linesToArray(event.target.value))
          }
        />
      </Field>
    </div>
  );
}
