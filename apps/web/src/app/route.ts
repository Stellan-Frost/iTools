export type AppRoute =
  | { page: 'home' }
  | { page: 'category'; categoryId: string }
  | { page: 'tool'; toolId: string }
  | { page: 'tasks' }
  | { page: 'admin' };

export const HOME_ROUTE: AppRoute = { page: 'home' };
