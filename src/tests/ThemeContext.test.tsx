import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { SettingsProvider, useSettings } from '../context/SettingsContext';

function Controls() {
  const { theme, setTheme } = useTheme();
  const { settings, isDirty } = useSettings();
  return <><button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>Switch theme</button><output data-testid="theme">{theme}</output><output data-testid="settings">{JSON.stringify(settings)}</output><output data-testid="dirty">{String(isDirty)}</output></>;
}
const mount = () => render(<ThemeProvider><SettingsProvider><Controls /></SettingsProvider></ThemeProvider>);
beforeEach(() => { localStorage.clear(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); delete document.documentElement.dataset.theme; });

describe('appearance preference boundaries', () => {
  it('restores the selected appearance without changing mouse settings', () => {
    const view = mount();
    const settings = screen.getByTestId('settings').textContent;
    const stored = localStorage.getItem('xd5_mouse_settings');
    fireEvent.click(screen.getByRole('button', { name: 'Switch theme' }));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(screen.getByTestId('dirty').textContent).toBe('false');
    expect(screen.getByTestId('settings').textContent).toBe(settings);
    expect(localStorage.getItem('xd5_mouse_settings')).toBe(stored);
    view.unmount();
    mount();
    expect(screen.getByTestId('theme').textContent).toBe('light');
  });
  it('rejects invalid stored preferences and allows a new explicit choice', () => {
    localStorage.setItem('xd5_ui_theme', 'invalid');
    mount();
    expect(screen.getByTestId('theme').textContent).toBe('dark');
    fireEvent.click(screen.getByRole('button', { name: 'Switch theme' }));
    expect(localStorage.getItem('xd5_ui_theme')).toBe('light');
  });
  it('keeps appearance switching usable when preference storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage blocked'); });
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Switch theme' }));
    expect(screen.getByTestId('theme').textContent).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
