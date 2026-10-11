/** Static-export friendly routes (detail screens read `?id=`, see lib/routes). */
export const fitnessRoutes = {
  home: "/fitness",
  analytics: "/fitness/analytics",
  activity: (id: string) => `/fitness/activity?id=${encodeURIComponent(id)}`,
};
