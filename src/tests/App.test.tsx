import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import App, { AppContent } from '../App';
import { DeviceContext, type DeviceContextType } from '../context/DeviceContext';
import { SettingsContext, type SettingsContextType } from '../context/SettingsContext';
import { ThemeProvider } from '../context/ThemeContext';
import { createDefaultSettings } from '../core/settings';
import { XD5Protocol } from '../core/protocol';

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(navigator, 'hid', { configurable: true, value: {} });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function deviceState(overrides: Partial<DeviceContextType> = {}): DeviceContextType {
  return {
    isConnected: false, device: null, transport: 'disconnected', battery: null, logs: [],
    connect: async () => {}, disconnect: () => {}, sendHandshake: async () => {},
    pollBattery: async () => {}, applySettingsToHardware: async () => {},
    readSettingsFromHardware: async () => new Uint8Array(), isConnecting: false,
    isSyncing: false, clearLogs: () => {}, protocol: new XD5Protocol(), lastEvent: null,
    subscribeDeviceEvent: () => () => {}, ...overrides,
  };
}

function settingsState(overrides: Partial<SettingsContextType> = {}): SettingsContextType {
  return {
    settings: createDefaultSettings(), isDirty: false, isLoadedFromDevice: false,
    isReading: false, isSyncing: false, error: null, updateSettings: () => {},
    resetToDefaults: () => {}, applyToDevice: async () => {}, readFromDevice: async () => {},
    exportProfileJson: () => '{}', importProfileJson: () => true, markClean: () => {},
    ...overrides,
  };
}

function content(device: DeviceContextType, settings: SettingsContextType) {
  return <ThemeProvider><DeviceContext.Provider value={device}>
    <SettingsContext.Provider value={settings}><AppContent /></SettingsContext.Provider>
  </DeviceContext.Provider></ThemeProvider>;
}

function expectWorkspaceHidden() {
  expect(screen.queryByRole('banner')).toBeNull();
  expect(screen.queryByRole('tablist')).toBeNull();
  expect(screen.queryByRole('button', { name: /theme/i })).toBeNull();
  expect(screen.queryByRole('button', { name: /export profile/i })).toBeNull();
  expect(screen.queryByRole('button', { name: /import profile/i })).toBeNull();
  expect(screen.queryByTestId('mouse-stage')).toBeNull();
}

describe('connection-first workspace', () => {
  it('offers only connection before hardware settings are ready', () => {
    render(content(deviceState(), settingsState()));
    expectWorkspaceHidden();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Connect mouse' })).toBeDefined();
    expect(screen.getByRole('img', { name: 'Fantech Helios Go XD5 mouse' })).toBeDefined();
    expect(document.querySelectorAll('svg [tabindex]')).toHaveLength(0);
  });

  it('does not reveal settings during device selection or initial hardware read', () => {
    const view = render(content(deviceState({ isConnecting: true }), settingsState()));
    expectWorkspaceHidden();
    expect(screen.getByRole('button', { name: /connecting/i }).hasAttribute('disabled')).toBe(true);
    view.rerender(content(deviceState({ isConnected: true }), settingsState({ isReading: true })));
    expectWorkspaceHidden();
    expect(screen.getByRole('button', { name: /reading settings/i }).hasAttribute('disabled')).toBe(true);
    view.rerender(content(deviceState({ isConnected: true }), settingsState()));
    expectWorkspaceHidden();
  });

  it('opens the workspace only after connection and read completion, then hides it on disconnect', async () => {
    let finishRead: () => void = () => {};
    function ConnectionLifecycle() {
      const [connected, setConnected] = useState(false);
      const [ready, setReady] = useState(false);
      finishRead = () => setReady(true);
      return content(deviceState({
        isConnected: connected,
        connect: async () => { setConnected(true); },
        disconnect: () => { setConnected(false); setReady(false); },
      }), settingsState({ isLoadedFromDevice: ready, isReading: connected && !ready }));
    }
    render(<ConnectionLifecycle />);
    fireEvent.click(screen.getByRole('button', { name: 'Connect mouse' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /reading settings/i }).hasAttribute('disabled')).toBe(true));
    expectWorkspaceHidden();
    act(() => { finishRead(); });
    expect(screen.getByRole('tab', { name: 'DPI' })).toBeDefined();
    expect(screen.getByRole('button', { name: /export profile/i })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    expectWorkspaceHidden();
    expect(screen.getByRole('button', { name: 'Connect mouse' })).toBeDefined();
  });

  it('retries an initial read failure without reopening the browser picker', async () => {
    const connect = vi.fn();
    function ReadRetry() {
      const [ready, setReady] = useState(false);
      return content(deviceState({ isConnected: true, connect }), settingsState({
        isLoadedFromDevice: ready, error: ready ? null : 'Incomplete EEPROM read.',
        readFromDevice: async () => { setReady(true); },
      }));
    }
    render(<ReadRetry />);
    expectWorkspaceHidden();
    expect(screen.getByRole('alert').textContent).toContain('Incomplete EEPROM read.');
    fireEvent.click(screen.getByRole('button', { name: 'Retry reading settings' }));
    expect(await screen.findByRole('tab', { name: 'DPI' })).toBeDefined();
    expect(connect).not.toHaveBeenCalled();
  });

  it('shows connection failure and reconnects from the same action', async () => {
    let attempts = 0;
    const connect = async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('The device could not be opened.');
    };
    render(content(deviceState({ connect }), settingsState()));
    fireEvent.click(screen.getByRole('button', { name: 'Connect mouse' }));
    expect((await screen.findByRole('alert')).textContent).toContain('The device could not be opened.');
    expectWorkspaceHidden();
    fireEvent.click(screen.getByRole('button', { name: 'Try connecting again' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(attempts).toBe(2);
  });

  it.each([
    undefined,
    new DOMException('Picker dismissed', 'NotFoundError'),
    new DOMException('Picker dismissed', 'AbortError'),
    { name: 'NotFoundError', message: 'Picker dismissed in another realm' },
  ])(
    'returns to a non-error disconnected screen when selection is cancelled (%s)', async cancellation => {
      render(content(deviceState({ connect: async () => { if (cancellation) throw cancellation; } }), settingsState()));
      fireEvent.click(screen.getByRole('button', { name: 'Connect mouse' }));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Connect mouse' }).hasAttribute('disabled')).toBe(false));
      expect(screen.queryByRole('alert')).toBeNull();
      expectWorkspaceHidden();
      expect(screen.getByRole('button', { name: 'Connect mouse' }).hasAttribute('disabled')).toBe(false);
    }
  );

  it('gives browser guidance without exposing unavailable actions', () => {
    Object.defineProperty(navigator, 'hid', { configurable: true, value: undefined });
    render(<App />);
    expectWorkspaceHidden();
    expect(screen.getByRole('alert').textContent).toMatch(/Chrome or Edge/i);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('removes the entire workspace immediately on disconnect, even with stale readiness', () => {
    const ready = settingsState({ isLoadedFromDevice: true });
    const view = render(content(deviceState({ isConnected: true }), ready));
    expect(screen.getByRole('tab', { name: 'DPI' })).toBeDefined();
    view.rerender(content(deviceState(), ready));
    expectWorkspaceHidden();
    expect(screen.getByRole('button', { name: 'Connect mouse' })).toBeDefined();
    expect(screen.getByText(/mouse disconnected/i)).toBeDefined();
  });
});

describe('connected workbench interactions', () => {
  function renderReady(overrides: Partial<SettingsContextType> = {}) {
    return render(content(deviceState({ isConnected: true, transport: 'wired' }), settingsState({
      isLoadedFromDevice: true, ...overrides,
    })));
  }

  it('keeps the mouse mounted through keyboard tab transitions', () => {
    renderReady();
    const mouse = screen.getByTestId('mouse-stage');
    const dpi = screen.getByRole('tab', { name: 'DPI' });
    dpi.focus();
    fireEvent.keyDown(dpi, { key: 'End' });
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Device log' }));
    expect(screen.getByRole('tabpanel').id).toBe('panel-diagnostics');
    expect(screen.getByTestId('mouse-stage')).toBe(mouse);
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(dpi);
    expect(screen.getByRole('tabpanel').id).toBe('panel-dpi');
    fireEvent.keyDown(dpi, { key: 'ArrowLeft' });
    expect(screen.getByRole('tabpanel').id).toBe('panel-diagnostics');
    fireEvent.keyDown(document.activeElement!, { key: 'Home' });
    expect(document.activeElement).toBe(dpi);
  });

  it('opens the matching button binding when a mouse hotspot is selected', () => {
    renderReady();
    fireEvent.click(screen.getByTestId('hotspot-pin-4'));
    expect(screen.getByRole('tabpanel').id).toBe('panel-remap');
    expect(screen.getByTestId('key-remap-card-4').getAttribute('data-focused')).toBe('true');
  });

  it('allows theme changes only within the loaded workspace', () => {
    renderReady();
    fireEvent.click(screen.getByRole('button', { name: 'Use light theme' }));
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('does not describe dirty or failed writes as synchronized', () => {
    const view = renderReady({ isDirty: true });
    expect(screen.getByRole('region', { name: 'Mouse sync status' }).textContent).toMatch(/changes waiting to sync/i);
    expect(screen.queryByText('In sync with mouse')).toBeNull();
    view.rerender(content(deviceState({ isConnected: true }), settingsState({
      isLoadedFromDevice: true, isDirty: true, error: 'Flash commit failed.',
    })));
    expect(screen.getByRole('alert').textContent).toContain('Flash commit failed.');
    expect(screen.queryByText('In sync with mouse')).toBeNull();
    expect(screen.getByRole('button', { name: 'Retry sync' }).hasAttribute('disabled')).toBe(false);
  });

  it('reports sync activity and disables reload while a transfer is in progress', () => {
    renderReady({ isSyncing: true, isDirty: true });
    expect(screen.getByRole('region', { name: 'Mouse sync status' }).textContent).toMatch(/saving changes to mouse/i);
    expect(screen.getByRole('button', { name: 'Reload from mouse' }).hasAttribute('disabled')).toBe(true);
    expect(screen.queryByText('In sync with mouse')).toBeNull();
  });

  it('keeps the workspace and export available while manual reads block editing', () => {
    const view = renderReady();
    const mouse = screen.getByTestId('mouse-stage');
    view.rerender(content(deviceState({ isConnected: true }), settingsState({
      isLoadedFromDevice: true, isReading: true,
    })));
    expect(screen.getByTestId('mouse-stage')).toBe(mouse);
    expect(screen.getByRole('tab', { name: 'DPI' })).toBeDefined();
    expect(screen.getByRole('checkbox', { name: 'Separate X & Y DPI' }).closest('fieldset')?.disabled).toBe(true);
    expect(screen.getByRole('button', { name: /import profile/i }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: /export profile/i }).hasAttribute('disabled')).toBe(false);
    expect(screen.getByRole('button', { name: 'Reading…' }).hasAttribute('disabled')).toBe(true);
    view.rerender(content(deviceState({ isConnected: true }), settingsState({
      isLoadedFromDevice: true, error: 'Reload failed.',
    })));
    expect(screen.getByTestId('mouse-stage')).toBe(mouse);
    expect(screen.getByRole('alert').textContent).toContain('Reload failed.');
    expect(screen.getByRole('checkbox', { name: 'Separate X & Y DPI' }).closest('fieldset')?.disabled).toBe(false);
    expect(screen.getByRole('button', { name: /export profile/i }).hasAttribute('disabled')).toBe(false);
  });

  it('keeps the dirty draft when reload confirmation is cancelled', async () => {
    const readFromDevice = vi.fn(async () => {});
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderReady({ isDirty: true, readFromDevice });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Reload from mouse' })); });
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(readFromDevice).not.toHaveBeenCalled();
    expect(screen.getByRole('region', { name: 'Mouse sync status' }).textContent).toMatch(/changes waiting to sync/i);
  });

  it('reloads only after confirming a dirty draft replacement', async () => {
    const readFromDevice = vi.fn(async () => {});
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderReady({ isDirty: true, readFromDevice });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Reload from mouse' })); });
    expect(readFromDevice).toHaveBeenCalledTimes(1);
  });

  it('reloads clean settings without a destructive-change prompt', async () => {
    const readFromDevice = vi.fn(async () => {});
    const confirm = vi.spyOn(window, 'confirm');
    renderReady({ readFromDevice });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Reload from mouse' })); });
    expect(confirm).not.toHaveBeenCalled();
    expect(readFromDevice).toHaveBeenCalledTimes(1);
  });

  it('retries a failed write without discarding or rereading the draft', async () => {
    const applyToDevice = vi.fn(async () => {});
    const readFromDevice = vi.fn(async () => {});
    renderReady({ isDirty: true, error: 'Flash commit failed.', applyToDevice, readFromDevice });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Retry sync' })); });
    expect(applyToDevice).toHaveBeenCalledTimes(1);
    expect(readFromDevice).not.toHaveBeenCalled();
  });
});
