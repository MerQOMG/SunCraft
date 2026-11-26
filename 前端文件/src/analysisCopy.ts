import type { Simulation } from './model';
/** Presentation-only solstice-diagram labels. Never invents rays or scores. */
export function caseRayLegend(result: Simulation | null) {
  if (!result)
    return { ready: false as const, summer: false, winter: false, noSummerIncident: false };
  const summer = result.svg_rays.summer_incident !== false && !!result.svg_rays.summer?.length;
  return {
    ready: true as const,
    summer,
    winter: !!result.svg_rays.winter?.length || Number.isFinite(result.svg_rays.winter_hit_depth),
    noSummerIncident: result.svg_rays.summer_incident === false,
  };
}
export function networkErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (
    /failed to fetch|networkerror|load failed|err_internet_disconnected|err_name_not_resolved/i.test(
      message,
    ) ||
    (error instanceof TypeError &&
      !message.startsWith('后端') &&
      !message.startsWith('当前窗墙比') &&
      !message.startsWith('请求超时') &&
      !message.startsWith('评分'))
  )
    return '无法连接计算服务，请检查网络或后端后重试。';
  return message || '计算请求失败';
}
