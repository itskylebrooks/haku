import { createContext, useContext } from 'react';

export const AppScrollContainerContext = createContext<HTMLElement | null>(null);

export const useAppScrollContainer = (): HTMLElement | null =>
  useContext(AppScrollContainerContext);
