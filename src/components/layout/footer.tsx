import Link from "next/link";

const LINK_GROUPS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Get started",
    links: [
      { label: "Register as a Vendor", href: "/vendors" },
      { label: "Register your Society", href: "/register/society" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About ProSoc", href: "/about" },
      { label: "Contact Us", href: "/contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms and Conditions", href: "/terms" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border-subtle px-6 py-10 text-[13px]">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 sm:flex-row sm:justify-between">
        <div>
          <p className="text-[15px] font-bold text-text-primary">ProSoc</p>
          <p className="mt-1 max-w-[220px] text-text-secondary">
            Fair, transparent procurement for housing societies.
          </p>
        </div>

        <div className="flex flex-wrap gap-10">
          {LINK_GROUPS.map((group) => (
            <div key={group.title}>
              <p className="font-semibold text-text-primary">{group.title}</p>
              <ul className="mt-2 flex flex-col gap-2">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-text-secondary hover:text-text-primary hover:underline">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <p className="mx-auto mt-8 w-full max-w-4xl border-t border-border-subtle pt-6 text-center text-text-secondary">
        © {new Date().getFullYear()} ProSoc · Fair, transparent procurement for housing societies
      </p>
    </footer>
  );
}
