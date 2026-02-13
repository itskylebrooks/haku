import { useDesktopLayout } from '@/shared/hooks/useDesktopLayout';

const sections = [
  {
    title: 'What sync will do',
    body: 'When sync is available, Haku will keep a secure copy of your app data up to date so you can move between devices without manual transfers. The goal is simple: open Haku anywhere and continue with the same activities and settings.',
  },
  {
    title: 'What sync will not do',
    body: 'Sync will not lock core planning behind a paywall. Haku stays fully usable without signing in, and local-only use remains supported.',
  },
  {
    title: 'Local-first stays the default',
    body: 'Even with sync, your data will still exist on your device. Sync is intended as convenience, not a requirement. If you stay offline, your normal Haku workflow does not change.',
  },
  {
    title: 'Export and import remain available',
    body: 'You can still export backups and import them whenever you want. Sync is meant to reduce manual work, not remove your control over data portability.',
  },
  {
    title: "Why it's a paid feature",
    body: 'Sync has ongoing costs: secure servers, storage, and maintenance. A small subscription would cover those costs and support long-term development of Haku. If you choose sync, you are paying for cross-device convenience and reliability.',
  },
  {
    title: 'Status',
    body: 'Sync is not implemented yet. This page exists to document the direction clearly before launch. When it becomes available, you will be able to choose whether to enable it, and Haku will remain usable either way.',
  },
] as const;

export default function SyncPage() {
  const { isDesktop } = useDesktopLayout();

  return (
    <div className={`mx-auto w-full max-w-xl px-4 pb-8 ${isDesktop ? 'pt-0' : 'pt-4'}`}>
      <div className="space-y-7">
        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">Sync</h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-subtle)]">
            Sync is an optional feature planned for Haku. It is designed for people who use Haku
            on multiple devices and want their activities and preferences to stay in sync
            automatically.
          </p>
        </section>

        {sections.map((section) => (
          <section key={section.title}>
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">{section.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-subtle)]">
              {section.body}
            </p>
          </section>
        ))}
      </div>
    </div>
  );
}
