export interface RoleMobileNavigationItem {
  label: string;
  route: string;
  icon: string;
  badge?: number;
  badgeTone?: 'default' | 'danger';
}

export interface RoleMobileNavigationConfig {
  menuId: string;
  roleLabel: string;
  ariaLabel: string;
  items: readonly RoleMobileNavigationItem[];
}
