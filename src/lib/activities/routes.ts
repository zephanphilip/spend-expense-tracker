/** Static-export friendly routes (detail screens read `?id=`, see lib/routes). */
export const activityRoutes = {
  home: "/activities",
  analytics: "/activities/analytics",
  activity: (id: string) => `/activities/activity?id=${encodeURIComponent(id)}`,
};

/**
 * The tracker used to live under /fitness. Those URLs stay valid — bookmarks, installed
 * shortcuts and reminder notifications already on a device point at them — and redirect here
 * with their query string (e.g. /fitness?check=<id>&date=<day>&do=complete).
 */
export const LEGACY_ACTIVITY_PATHS: Record<string, string> = {
  "/fitness": activityRoutes.home,
  "/fitness/analytics": activityRoutes.analytics,
  "/fitness/activity": "/activities/activity",
};
