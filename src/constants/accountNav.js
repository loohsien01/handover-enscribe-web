/** Account settings secondary nav (see AccountShell). */
export const ACCOUNT_NAV = [
  {
    slug: "profile",
    label: "Profile",
    description: "Username and medical profession",
  },
  {
    slug: "billing",
    label: "Plan & billing",
    description: "Subscription and plan details",
  },
  {
    slug: "legal",
    label: "Legal & compliance",
    description: "Agreements and policies",
  },
  {
    slug: "security",
    label: "Security",
    description: "Coming soon",
    disabled: true,
  },
];

export function accountPath(slug) {
  return `/account/${slug}`;
}
