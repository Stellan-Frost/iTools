import {
  NavigationDrawerItem,
  NavigationRailItem,
} from '@itools/design-system-adapter';
import { categories } from '../../data/sample-catalog.js';
import { AppIcon } from '../app-icon/AppIcon.js';

interface NavigationItemsProps {
  type: 'drawer' | 'rail';
  isRailExpanded?: boolean;
}

export function NavigationItems({
  type,
  isRailExpanded = true,
}: NavigationItemsProps) {
  return (
    <>
      {type === 'rail' ? (
        <NavigationRailItem
          value="home"
          icon={<AppIcon name="home" />}
          label="首页"
        />
      ) : (
        <NavigationDrawerItem
          value="home"
          icon={<AppIcon name="home" />}
          label="首页"
        />
      )}
      {categories.map((category) =>
        type === 'rail' ? (
          <NavigationRailItem
            key={category.id}
            value={category.id}
            icon={<AppIcon name={category.icon} />}
            selectedIcon={<AppIcon name={category.icon} />}
            label={isRailExpanded ? category.name : category.shortName}
            aria-label={category.name}
          />
        ) : (
          <NavigationDrawerItem
            key={category.id}
            value={category.id}
            icon={<AppIcon name={category.icon} />}
            label={category.name}
          />
        ),
      )}
    </>
  );
}
