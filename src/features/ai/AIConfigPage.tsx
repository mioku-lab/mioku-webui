import { useEffect, useRef, useState } from "react";
import { Save } from "lucide-react";
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
import { apiFetch } from "@/lib/api";
import { useTopbar } from "@/components/layout/TopbarContext";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { cn } from "@/lib/utils";

type Strength = "low" | "medium" | "high";

type BaseConfig = {
  apiUrl: string;
  apiKey: string;
  model: string;
  workingModel: string;
  multimodalWorkingModel: string;
  isMultimodal: boolean;
  maxContextTokens: number;
  temperature: number;
  historyCount: number;
  maxIterations: number;
};

type SettingsConfig = {
  searxng: {
    enabled: boolean;
    baseUrl: string;
    timeoutMs: number;
    defaultLimit: number;
    maxLimit: number;
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
    baseUrl: string;
    apiKey: string;
    timeoutMs: number;
  };
  blacklistGroups: string[];
  whitelistGroups: string[];
  imageAnalysisBlacklistUsers: string[];
  maxSessions: number;
  enableGroupAdmin: boolean;
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
  dynamicDelay: {
    enabled: boolean;
    interactionWindowMs: number;
    baseDelayMs: number;
    maxDelayMs: number;
  };
};

type PersonalizationConfig = {
  persona: string;
  personality: {
    states: string[];
    stateProbability: number;
  };
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
  typo: {
    enabled: boolean;
    errorRate: number;
    wordReplaceRate: number;
  };
  emoji: {
    enabled: boolean;
    characters: string[];
    useAISelection: boolean;
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

type ConfigTab = "model" | "behavior" | "persona" | "capability";

const tabLabels: Record<ConfigTab, string> = {
  model: "模型接入",
  behavior: "回复策略",
  persona: "角色设定",
  capability: "能力开关",
};

const emptyBaseConfig: BaseConfig = {
  apiUrl: "",
  apiKey: "",
  model: "",
  workingModel: "",
  multimodalWorkingModel: "",
  isMultimodal: true,
  maxContextTokens: 128,
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
    baseUrl: "http://127.0.0.1:9880",
    apiKey: "",
    timeoutMs: 20000,
  },
  blacklistGroups: [],
  whitelistGroups: [],
  imageAnalysisBlacklistUsers: [],
  maxSessions: 100,
  enableGroupAdmin: true,
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
  dynamicDelay: {
    enabled: true,
    interactionWindowMs: 60000,
    baseDelayMs: 30000,
    maxDelayMs: 300000,
  },
};

const emptyPersonalizationConfig: PersonalizationConfig = {
  persona: "",
  personality: {
    states: [],
    stateProbability: 0.15,
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
  typo: {
    enabled: true,
    errorRate: 0.03,
    wordReplaceRate: 0.1,
  },
  emoji: {
    enabled: false,
    characters: [],
    useAISelection: true,
  },
  expression: {
    enabled: true,
    learnAfterMessages: 100,
    sampleSize: 8,
  },
};

function linesToArray(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function arrayToLines(value: string[]): string {
  return value.join("\n");
}

function normalizeEscapedNewlines(value: string): string {
  return String(value || "")
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n");
}

function shouldIgnoreCardToggle(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target.closest(
      "input, textarea, select, button, a, label, [role='button'], [data-stop-card-toggle='true']",
    ),
  );
}

function getCheckboxCardClass(active: boolean, compact = false): string {
  return cn(
    "rounded-xl border bg-card/78 transition-all duration-200 ease-out",
    "active:scale-[0.992] active:bg-secondary/45",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
    compact ? "p-3" : "p-4",
    active ? "border-primary/45 bg-secondary/35" : "border-border/85",
  );
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
      ] = await Promise.all([
        apiFetch<{ data: BaseConfig }>("/api/ai/base"),
        apiFetch<{ data: PersonalizationConfig }>("/api/ai/personalization"),
        apiFetch<{ data: SettingsConfig }>("/api/ai/settings"),
        apiFetch<{ data: string[] }>("/api/ai/instances"),
        apiFetch<{ data: { skills: string[]; tools: string[] } }>(
          "/api/ai/skills",
        ),
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
        personality: {
          ...emptyPersonalizationConfig.personality,
          ...(personalizationRes.data?.personality || {}),
        },
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
        typo: {
          ...emptyPersonalizationConfig.typo,
          ...(personalizationRes.data?.typo || {}),
        },
        emoji: {
          ...emptyPersonalizationConfig.emoji,
          ...(personalizationRes.data?.emoji || {}),
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
        dynamicDelay: {
          ...emptySettingsConfig.dynamicDelay,
          ...(settingsRes.data?.dynamicDelay || {}),
        },
      };

      setBase(nextBase);
      setPersonalization(nextPersonalization);
      setSettings(nextSettings);
      setResources({
        instances: instancesRes.data || [],
        skills: skillsRes.data?.skills || [],
        tools: skillsRes.data?.tools || [],
      });

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
      await Promise.all([
        apiFetch("/api/ai/base", {
          method: "PUT",
          body: JSON.stringify(base),
        }),
        apiFetch("/api/ai/personalization", {
          method: "PUT",
          body: JSON.stringify(personalization),
        }),
        apiFetch("/api/ai/settings", {
          method: "PUT",
          body: JSON.stringify(settings),
        }),
      ]);
      initialSnapshotRef.current = JSON.stringify({
        base,
        personalization,
        settings,
      });
      setHasChanges(false);
      toast.success("设置已保存~");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    const chipClass = (active: boolean) =>
      `topbar-chip whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium ${
        active
          ? "border-transparent bg-primary text-primary-foreground shadow-sm"
          : "border-transparent bg-secondary/50 text-secondary-foreground hover:bg-secondary"
      }`;

    setLeftContent(
      <div className="topbar-chip-scroll flex items-center gap-1 overflow-x-auto">
        {(Object.keys(tabLabels) as ConfigTab[]).map((tab, index) => (
          <span
            key={tab}
            className="topbar-nav-item-enter"
            style={{ animationDelay: `${index * 45}ms` }}
          >
            <button
              type="button"
              onClick={() => setActiveTab(tab)}
              className={chipClass(activeTab === tab)}
            >
              {tabLabels[tab]}
            </button>
          </span>
        ))}
      </div>,
    );

    return () => setLeftContent(null);
  }, [activeTab, setLeftContent]);

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
          normalizedNext.length === availableSkills.length ? [] : normalizedNext,
      };
    });
  };

  const setAllowAllExternalSkills = (checked: boolean) => {
    updateSettings("allowedExternalSkills", checked ? [] : [...resources.skills]);
  };

  const summaryItems = [
    {
      label: "当前主模型",
      value: base.model || "未设置",
      hint: base.isMultimodal ? "支持图片理解" : "纯文本",
    },
    {
      label: "已注册能力",
      value: `${resources.skills.length} Skills / ${resources.tools.length} Tools`,
      hint: "系统已加载的扩展能力",
    },
    {
      label: "人格 / 风格",
      value: `${personalization.personality.states.length} / ${personalization.replyStyle.multipleStyles.length}`,
      hint: "已配置的人格和回复风格数量",
    },
    {
      label: "能力状态",
      value: `${countEnabledCapabilities(personalization, settings)} 项已开启`,
      hint: "记忆、话题、搜索、网页阅读等能力",
    },
  ];

  const renderModelTab = () => (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>模型接入</CardTitle>
          <CardDescription>
            这里决定 chat
            插件使用哪个接口、哪个主模型，以及轻量任务和多模态任务分别走什么模型
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="API 地址" hint="例如 OpenAI 兼容网关或官方接口">
            <Input
              value={base.apiUrl}
              onChange={(e) => updateBase("apiUrl", e.target.value)}
              placeholder="https://api.openai.com/v1"
            />
          </Field>
          <Field label="API Key" hint="保存后写入 chat/base.json">
            <Input
              type="password"
              value={base.apiKey}
              onChange={(e) => updateBase("apiKey", e.target.value)}
              placeholder="sk-..."
            />
          </Field>
          <Field label="主模型" hint="正式生成回复时使用，要求智商高">
            <Input
              value={base.model}
              onChange={(e) => updateBase("model", e.target.value)}
              placeholder="gpt-4.1 / gemini / deepseek..."
            />
          </Field>
          <Field label="工作模型" hint="用于 planner 等轻量任务，要求速度快">
            <Input
              value={base.workingModel}
              onChange={(e) => updateBase("workingModel", e.target.value)}
              placeholder="deepseek/deepseek-v3.2-exp"
            />
          </Field>
          <Field label="多模态工作模型" hint="用于图片描述和视觉任务，要求便宜">
            <Input
              value={base.multimodalWorkingModel}
              onChange={(e) =>
                updateBase("multimodalWorkingModel", e.target.value)
              }
              placeholder="doubao-seed-2.0-mini"
            />
          </Field>
          <Field label="上下文窗口" hint="保留多少条消息上下文">
            <NumberInput
              value={base.maxContextTokens}
              onValueChange={(value) => {
                if (value !== null) updateBase("maxContextTokens", value);
              }}
            />
          </Field>
          <Field label="温度" hint="越高越发散，越低越稳定">
            <NumberInput
              step="0.1"
              value={base.temperature}
              onValueChange={(value) => {
                if (value !== null) updateBase("temperature", value);
              }}
            />
          </Field>
          <Field label="群聊历史消息数" hint="会参与上下文拼接的历史条数">
            <NumberInput
              value={base.historyCount}
              onValueChange={(value) => {
                if (value !== null) updateBase("historyCount", value);
              }}
            />
          </Field>
          <Field label="最大迭代次数" hint="-1 表示不限制">
            <NumberInput
              value={base.maxIterations}
              onValueChange={(value) => {
                if (value !== null) updateBase("maxIterations", value);
              }}
            />
          </Field>
          <Field label="多模态能力" hint="关闭后不会启用多模态能力">
            <Toggle
              checked={base.isMultimodal}
              onChange={(checked) => updateBase("isMultimodal", checked)}
              label={base.isMultimodal ? "已开启" : "已关闭"}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>已加载 AI 资源</CardTitle>
          <CardDescription>
            这部分是当前系统运行时已注册的实例、技能和工具，方便你对照实际能力。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <TagGroup
            title="实例"
            emptyLabel="当前没有额外实例"
            items={resources.instances}
          />
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
    </div>
  );

  const renderBehaviorTab = () => (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>回复体验</CardTitle>
          <CardDescription>
            控制 chat 插件怎么回、多久回、是否展示流式输出和打字停顿。
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
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
          <Field label="最大会话数" hint="超过后旧会话会被回收">
            <NumberInput
              value={settings.maxSessions}
              onValueChange={(value) => {
                if (value !== null) updateSettings("maxSessions", value);
              }}
            />
          </Field>
          <Field
            label="回复后冷却时间 (分钟)"
            hint="群聊内 bot 回复后的基础冷却"
          >
            <NumberInput
              value={settings.cooldownAfterReplyMs / 60000}
              onValueChange={(value) => {
                if (value !== null) {
                  updateSettings("cooldownAfterReplyMs", value * 60000);
                }
              }}
            />
          </Field>
          <Field
            label="群对话结构化历史保留时长 (分钟)"
            hint="群里最后一次有人和 bot 对话后，这段结构化 user/assistant/tool 历史保留多久"
          >
            <NumberInput
              value={settings.groupStructuredHistoryTtlMs / 60000}
              onValueChange={(value) => {
                if (value !== null) {
                  updateSettings("groupStructuredHistoryTtlMs", value * 60000);
                }
              }}
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
          <Field
            label="工具使用约束强度"
            hint="越高越严格限制调用工具，越不容易乱查乱用"
          >
            <SelectField
              value={settings.toolCallConstraintStrength}
              onChange={(value) =>
                updateSettings("toolCallConstraintStrength", value as Strength)
              }
              options={[
                { label: "低", value: "low" },
                { label: "中", value: "medium" },
                { label: "高", value: "high" },
              ]}
            />
          </Field>
          <Field
            label="表情包约束强度"
            hint="越高越克制使用表情包，越低越容易用来加强情绪"
          >
            <SelectField
              value={settings.emojiUsageConstraintStrength}
              onChange={(value) =>
                updateSettings(
                  "emojiUsageConstraintStrength",
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
          <Field
            label="语音约束强度"
            hint="越高越克制使用语音，越低越容易在短句和强情绪时使用"
          >
            <SelectField
              value={settings.audioUsageConstraintStrength}
              onChange={(value) =>
                updateSettings(
                  "audioUsageConstraintStrength",
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
          <Field
            label="Markdown 约束强度"
            hint="越高越克制使用结构化长内容截图，越低越容易在需要说明时使用"
          >
            <SelectField
              value={settings.markdownUsageConstraintStrength}
              onChange={(value) =>
                updateSettings(
                  "markdownUsageConstraintStrength",
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

      <Card>
        <CardHeader>
          <CardTitle>功能开关</CardTitle>
          <CardDescription>
            这部分影响交互观感和开放范围，用来调试 bot 的回复节奏
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
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
            onChange={(checked) => updateSettings("enableTypingDelay", checked)}
          />
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
            description="允许 AI 在合适场景下合成并发送语音消息"
            checked={settings.audio.enabled}
            onChange={(checked) =>
              setSettings((prev) => ({
                ...prev,
                audio: { ...prev.audio, enabled: checked },
              }))
            }
          />
          <ToggleField
            title="群管理员权限"
            description="允许群管理员获得额外控制能力"
            checked={settings.enableGroupAdmin}
            onChange={(checked) => updateSettings("enableGroupAdmin", checked)}
          />
          <ToggleField
            title="外部 Skills"
            description="允许调用额外注册的技能扩展"
            checked={settings.enableExternalSkills}
            onChange={(checked) =>
              updateSettings("enableExternalSkills", checked)
            }
          />
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>外部 Skills 范围</CardTitle>
          <CardDescription>
            控制 chat 插件通过外部 Skills 能加载哪些扩展能力。留空表示允许全部已注册
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
                      "flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 text-sm transition-colors",
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

      <Card>
        <CardHeader>
          <CardTitle>语音消息</CardTitle>
          <CardDescription>
            配置独立的 GPT-SoVITS TTS 接口。启用后，AI
            可以在合适场景下发送简短语音。
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Field label="TTS API 地址" hint="例如 http://127.0.0.1:9880">
            <Input
              value={settings.audio.baseUrl}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  audio: { ...prev.audio, baseUrl: e.target.value },
                }))
              }
              placeholder="http://127.0.0.1:9880"
            />
          </Field>
          <Field label="TTS API Key" hint="对应 GPT-SoVITS 服务端的 X-API-Key">
            <Input
              type="password"
              value={settings.audio.apiKey}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  audio: { ...prev.audio, apiKey: e.target.value },
                }))
              }
              placeholder="留空表示不校验"
            />
          </Field>
          <Field label="TTS 超时 (秒)" hint="语音合成请求的超时时间">
            <NumberInput
              value={settings.audio.timeoutMs / 1000}
              onValueChange={(value) => {
                if (value === null) return;
                setSettings((prev) => ({
                  ...prev,
                  audio: {
                    ...prev.audio,
                    timeoutMs: value * 1000,
                  },
                }));
              }}
            />
          </Field>
        </CardContent>
      </Card>

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

      <Card>
        <CardHeader>
          <CardTitle>黑白名单</CardTitle>
          <CardDescription>
            支持按群号或用户号限制 chat 插件的触发范围
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Field label="群聊黑名单" hint="每行一个群号，命中后不回复">
            <Textarea
              className="min-h-32"
              value={arrayToLines(settings.blacklistGroups)}
              onChange={(e) =>
                updateSettings("blacklistGroups", linesToArray(e.target.value))
              }
            />
          </Field>
          <Field label="群聊白名单" hint="非空时仅对白名单群生效">
            <Textarea
              className="min-h-32"
              value={arrayToLines(settings.whitelistGroups)}
              onChange={(e) =>
                updateSettings("whitelistGroups", linesToArray(e.target.value))
              }
            />
          </Field>
          <Field
            label="图片分析黑名单用户"
            hint="每行一个 QQ 号，这些人发的图片不会进入分析"
          >
            <Textarea
              className="min-h-32"
              value={arrayToLines(settings.imageAnalysisBlacklistUsers)}
              onChange={(e) =>
                updateSettings(
                  "imageAnalysisBlacklistUsers",
                  linesToArray(e.target.value),
                )
              }
            />
          </Field>
        </CardContent>
      </Card>
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
            <Field label="人格状态" hint="每行一个状态，bot 会随机切换">
              <Textarea
                className="min-h-48"
                value={arrayToLines(personalization.personality.states)}
                onChange={(e) =>
                  setPersonalization((prev) => ({
                    ...prev,
                    personality: {
                      ...prev.personality,
                      states: linesToArray(e.target.value),
                    },
                  }))
                }
              />
            </Field>
            <div className="space-y-4">
              <Field
                label="人格切换概率"
                hint="0 到 1 之间，越高越容易切换状态"
              >
                <NumberInput
                  step="0.01"
                  value={personalization.personality.stateProbability}
                  onValueChange={(value) => {
                    if (value === null) return;
                    setPersonalization((prev) => ({
                      ...prev,
                      personality: {
                        ...prev.personality,
                        stateProbability: value,
                      },
                    }));
                  }}
                />
              </Field>
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
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
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
        </CardContent>
      </Card>
    </div>
  );

  const renderCapabilityTab = () => (
    <div className="space-y-4">
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
            <Field label="空闲检查 bot ID" hint="每行一个；留空时使用全部 bot">
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

      <Card>
        <CardHeader>
          <CardTitle>风格增强</CardTitle>
          <CardDescription>
            这些选项负责AI的小毛病，会明显改变 bot 的拟人感
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <CapabilityCard
            title="Typo"
            description="制造轻微错字和替换，减少 AI 味"
            enabled={personalization.typo.enabled}
            onEnabledChange={(checked) =>
              setPersonalization((prev) => ({
                ...prev,
                typo: { ...prev.typo, enabled: checked },
              }))
            }
          >
            <NumberField
              label="错字率"
              step="0.01"
              value={personalization.typo.errorRate}
              onChange={(value) =>
                setPersonalization((prev) => ({
                  ...prev,
                  typo: { ...prev.typo, errorRate: value },
                }))
              }
            />
            <NumberField
              label="替换率"
              step="0.01"
              value={personalization.typo.wordReplaceRate}
              onChange={(value) =>
                setPersonalization((prev) => ({
                  ...prev,
                  typo: { ...prev.typo, wordReplaceRate: value },
                }))
              }
            />
          </CapabilityCard>
          <CapabilityCard
            title="Emoji"
            description="选择表情图或 emoji 强化情绪输出"
            enabled={personalization.emoji.enabled}
            onEnabledChange={(checked) =>
              setPersonalization((prev) => ({
                ...prev,
                emoji: { ...prev.emoji, enabled: checked },
              }))
            }
          >
            <Toggle
              checked={personalization.emoji.useAISelection}
              onChange={(checked) =>
                setPersonalization((prev) => ({
                  ...prev,
                  emoji: { ...prev.emoji, useAISelection: checked },
                }))
              }
              label={
                personalization.emoji.useAISelection
                  ? "AI 自动选择"
                  : "手动角色过滤"
              }
            />
            <Field label="可用角色" hint="每行一个角色名，留空表示不过滤">
              <Textarea
                className="min-h-24"
                value={arrayToLines(personalization.emoji.characters)}
                onChange={(e) =>
                  setPersonalization((prev) => ({
                    ...prev,
                    emoji: {
                      ...prev.emoji,
                      characters: linesToArray(e.target.value),
                    },
                  }))
                }
              />
            </Field>
          </CapabilityCard>
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
    </div>
  );

  return (
    <div className="space-y-4 animate-soft-pop">
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="grid gap-px bg-border md:grid-cols-4">
            {summaryItems.map((item) => (
              <div key={item.label} className="bg-card p-5">
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <p className="mt-2 text-lg font-semibold">{item.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.hint}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="p-5 text-sm text-muted-foreground">
            正在加载 AI 配置...
          </CardContent>
        </Card>
      ) : null}

      {!loading && activeTab === "model" ? renderModelTab() : null}
      {!loading && activeTab === "behavior" ? renderBehaviorTab() : null}
      {!loading && activeTab === "persona" ? renderPersonaTab() : null}
      {!loading && activeTab === "capability" ? renderCapabilityTab() : null}
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
    <div
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      className={cn(
        getCheckboxCardClass(checked, true),
        "flex min-h-10 items-center gap-3 text-sm",
      )}
      onClick={(e) => {
        e.stopPropagation();
        if (shouldIgnoreCardToggle(e.target)) {
          return;
        }
        onChange(!checked);
      }}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          onChange(!checked);
        }
      }}
    >
      <input
        className="form-checkbox"
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </div>
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
    <div
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      className={getCheckboxCardClass(checked)}
      onClick={(e) => {
        if (shouldIgnoreCardToggle(e.target)) {
          return;
        }
        onChange(!checked);
      }}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          onChange(!checked);
        }
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <input
          className="form-checkbox mt-1"
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step,
  msToMin,
  msToSec,
}: {
  label: string;
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
    <Field label={label}>
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
    <div
      role="checkbox"
      aria-checked={enabled}
      tabIndex={0}
      className={cn(getCheckboxCardClass(enabled), "space-y-4")}
      onClick={(e) => {
        if (shouldIgnoreCardToggle(e.target)) {
          return;
        }
        onEnabledChange(!enabled);
      }}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          onEnabledChange(!enabled);
        }
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-base font-semibold">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <input
          className="form-checkbox mt-1"
          type="checkbox"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
        />
      </div>
      <div className="space-y-3">{children}</div>
    </div>
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
              className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground"
            >
              {item}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function countEnabledCapabilities(
  personalization: PersonalizationConfig,
  settings: SettingsConfig,
): number {
  return [
    personalization.memory.enabled,
    personalization.topic.enabled,
    personalization.planner.enabled,
    personalization.typo.enabled,
    personalization.emoji.enabled,
    personalization.expression.enabled,
    settings.searxng.enabled,
    settings.webReader.enabled,
    settings.audio.enabled,
    settings.dynamicDelay.enabled,
    settings.enableExternalSkills,
    settings.enableMarkdownScreenshot,
  ].filter(Boolean).length;
}
