/**
 * Detail screens are static pages that read the record id from `?id=` — the app is a static
 * export on Firebase Hosting, which can't pre-render pages for ids that only exist at runtime.
 *
 */
const detail = (base: string) => (id: string) => `${base}/detail?id=${encodeURIComponent(id)}`;

export const routes = {
  emi: detail("/emis"),
  account: detail("/accounts"),
  investment: detail("/investments"),
  goal: detail("/wishlist"),
};
