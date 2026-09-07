export type Bindings = Record<string, unknown>;

/** Public-data portal keys stay in server bindings. Specific keys can override a shared account key. */
export function publicDataKey(env: Bindings, serviceKey: string): string {
  return String(
    env[serviceKey] ||
      env.DATA_GO_KR_SERVICE_KEY ||
      env.TOUR_API_SERVICE_KEY ||
      '',
  ).trim();
}
