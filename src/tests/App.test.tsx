import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../App';

interface NavigatorWithHid {
  hid?: {
    requestDevice?: () => Promise<unknown[]>;
    getDevices?: () => Promise<unknown[]>;
    addEventListener?: () => void;
    removeEventListener?: () => void;
  };
}

describe('App root integration', () => {
  const nav = navigator as unknown as NavigatorWithHid;
  const originalHid = nav.hid;

  beforeEach(() => {
    // Default to mock HID enabled for general workbench tests
    Object.defineProperty(navigator, 'hid', {
      value: {
        requestDevice: () => Promise.resolve([]),
        getDevices: () => Promise.resolve([]),
        addEventListener: () => {},
        removeEventListener: () => {},
      },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    if (originalHid !== undefined) {
      Object.defineProperty(navigator, 'hid', {
        value: originalHid,
        configurable: true,
        writable: true,
      });
    } else {
      delete (navigator as unknown as Record<string, unknown>).hid;
    }
  });

  it('renders dual-pane shell and switches tabs correctly with WAI-ARIA semantics', () => {
    render(<App />);

    expect(screen.getByText('DPI Settings')).toBeDefined();
    expect(screen.getByText('Lighting (RGB)')).toBeDefined();

    const dpiTab = screen.getByRole('tab', { name: /DPI Settings/i });
    expect(dpiTab.getAttribute('aria-selected')).toBe('true');
    expect(dpiTab.getAttribute('aria-controls')).toBe('panel-dpi');
    expect(dpiTab.getAttribute('tabindex')).toBe('0');

    const panel = screen.getByRole('tabpanel');
    expect(panel.id).toBe('panel-dpi');
    expect(panel.getAttribute('aria-labelledby')).toBe('tab-dpi');

    const lightingTab = screen.getByRole('tab', { name: /Lighting \(RGB\)/i });
    expect(lightingTab.getAttribute('aria-selected')).toBe('false');
    expect(lightingTab.getAttribute('tabindex')).toBe('-1');

    fireEvent.click(lightingTab);
    expect(lightingTab.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel').id).toBe('panel-lighting');
    expect(screen.getByText(/LED Mode \/ Effect/i)).toBeDefined();
  });

  it('navigates through all 5 tabs and displays corresponding configuration decks', () => {
    render(<App />);

    // Default tab: DPI Settings
    expect(screen.getByText('DPI Studio')).toBeDefined();
    expect(screen.getByText('Separate X & Y DPI')).toBeDefined();

    // Tab 2: Lighting (RGB)
    fireEvent.click(screen.getByRole('tab', { name: /Lighting \(RGB\)/i }));
    expect(screen.getByText(/LED Mode \/ Effect/i)).toBeDefined();

    // Tab 3: Key Remapping
    fireEvent.click(screen.getByRole('tab', { name: /Key Remapping/i }));
    expect(screen.getByTestId('key-remap-card-1')).toBeDefined();

    // Tab 4: Sensor & Performance
    fireEvent.click(screen.getByRole('tab', { name: /Sensor & Performance/i }));
    expect(screen.getByText(/Polling Rate/i)).toBeDefined();

    // Tab 5: Protocol & Diagnostics
    fireEvent.click(screen.getByRole('tab', { name: /Protocol & Diagnostics/i }));
    expect(screen.getByText(/Live Protocol Console/i)).toBeDefined();
  });

  it('clicking a hotspot pin on MouseStage automatically switches to Key Remapping tab with that button focused', () => {
    render(<App />);

    // Initially on DPI settings
    expect(screen.queryByTestId('key-remap-card-1')).toBeNull();

    // Find hotspot pin for Button 4 (Backward)
    const pin4 = screen.getByTestId('hotspot-pin-4');
    expect(pin4).toBeDefined();
    fireEvent.click(pin4);

    // Should have automatically switched to Key Remapping tab
    expect(screen.getByTestId('key-remap-card-4')).toBeDefined();
    const btn4Card = screen.getByTestId('key-remap-card-4');
    // Button 4 card should have focused styling/attribute
    expect(btn4Card.getAttribute('data-focused')).toBe('true');
  });

  it('renders reverse-engineering attribution footer', () => {
    render(<App />);
    expect(screen.getAllByText(/Helios Go XD5/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/PAW3370/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('contentinfo')).toBeDefined();
  });

  it('renders WebHID browser support warning banner when navigator.hid is not supported', () => {
    // Delete navigator.hid to simulate Firefox / Safari
    delete (navigator as unknown as Record<string, unknown>).hid;

    render(<App />);
    expect(
      screen.getByText(/WebHID is not supported in this browser/i)
    ).toBeDefined();
    expect(screen.getByText(/Chrome|Edge|Opera/i)).toBeDefined();
  });

  it('does not render WebHID warning banner when navigator.hid is supported', () => {
    render(<App />);
    expect(
      screen.queryByText(/WebHID is not supported in this browser/i)
    ).toBeNull();
  });
});
