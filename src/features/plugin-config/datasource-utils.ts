export interface DatasourceOption {
  value: string;
  label: string;
  description?: string;
  meta?: {
    avatarUrl?: string;
    qq?: string;
    nickname?: string;
    remark?: string;
    groupId?: string;
    groupName?: string;
    memberCount?: number;
    searchText?: string;
    isCustom?: boolean;
    [key: string]: unknown;
  };
}

export function isPureQQNumber(query: string): boolean {
  const trimmed = query.trim();
  return /^\d{5,12}$/.test(trimmed);
}

/**
 * 构造一个"手动添加"的 QQ/群号条目。
 * 当用户搜索的号码不在当前列表中（既不是好友也不是已加群）时，
 * 用 QQ 服务器的头像地址 + 号码本身作为昵称生成一个临时条目，
 * 选中后直接把该号码写入配置。
 */
export function buildCustomOption(
  id: string,
  source?: string,
): DatasourceOption {
  const value = id.trim();
  if (source === "qq_groups") {
    return {
      value,
      label: value,
      description: `群号 ${value}`,
      meta: {
        type: "qq_group_custom",
        groupId: value,
        groupName: value,
        avatarUrl: `https://p.qlogo.cn/gh/${encodeURIComponent(value)}/${encodeURIComponent(value)}/100`,
        searchText: value,
        isCustom: true,
      },
    };
  }
  return {
    value,
    label: value,
    description: `QQ ${value}`,
    meta: {
      type: "qq_friend_custom",
      qq: value,
      nickname: value,
      avatarUrl: `https://q1.qlogo.cn/g?b=qq&nk=${encodeURIComponent(value)}&s=100`,
      searchText: value,
      isCustom: true,
    },
  };
}

/**
 * 解析已选中的值：当某个值不在 `options` 中（说明它是手动添加的），
 * 用 `buildCustomOption` 生成一个用于展示的条目。
 */
export function resolveDatasourceOption(
  value: string,
  options: DatasourceOption[],
  source?: string,
): DatasourceOption | null {
  const found = options.find((option) => option.value === String(value));
  if (found) return found;
  if (isPureQQNumber(value)) {
    return buildCustomOption(value, source);
  }
  return null;
}
