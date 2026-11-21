import { NavLink } from 'react-router';
import { Icon } from '@/components/ui/Icon';
import { BrandLogo } from '@/components/shared/BrandLogo';
import type { NavItem } from '@/app/navigation';
import { ar } from '@/locales/ar';

export function SidebarNav({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-sidebar">
      {/* The logo asset has a white background, so it sits on a white tile. */}
      <div className="p-4">
        <div className="flex justify-center rounded-md bg-surface px-3 py-2">
          <BrandLogo height={30} />
        </div>
      </div>

      <nav aria-label={ar.nav.label} className="flex-1 overflow-y-auto px-3 pb-4">
        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <li key={item.key}>
              <NavLink
                to={item.to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-md border-s-4 px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? 'border-accent bg-sidebar-hover font-medium text-fg-inverse'
                      : 'border-transparent text-fg-on-sidebar hover:bg-sidebar-hover hover:text-fg-inverse'
                  }`
                }
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
