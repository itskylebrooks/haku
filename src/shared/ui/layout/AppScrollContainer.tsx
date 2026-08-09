import type { ReactNode } from 'react';
import { AppScrollContainerContext } from './AppScrollContainerContext';

export const AppScrollContainerProvider = ({
  container,
  children,
}: {
  container: HTMLElement | null;
  children: ReactNode;
}) => (
  <AppScrollContainerContext.Provider value={container}>
    {children}
  </AppScrollContainerContext.Provider>
);
