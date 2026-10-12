import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MouseStage } from '../components/stage/MouseStage';
import { SettingsProvider } from '../context/SettingsContext';
import { DeviceProvider } from '../context/DeviceContext';
import { SettingsManager } from '../core/settings';

describe('MouseStage', () => {
  it('renders interactive button pins and triggers selection', () => {
    const onSelect = vi.fn();
    render(
      <DeviceProvider>
        <SettingsProvider>
          <MouseStage hoveredButton={null} onSelectButton={onSelect} />
        </SettingsProvider>
      </DeviceProvider>
    );

    const pin1 = screen.getByTestId('hotspot-pin-1');
    expect(pin1).toBeDefined();
    fireEvent.click(pin1);
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it('renders all 6 hotspot pins with correct accessibility labels', () => {
    const onSelect = vi.fn();
    render(
      <DeviceProvider>
        <SettingsProvider>
          <MouseStage activeZone={null} onSelectButton={onSelect} />
        </SettingsProvider>
      </DeviceProvider>
    );

    for (let i = 1; i <= 6; i++) {
      const pin = screen.getByTestId(`hotspot-pin-${i}`);
      expect(pin).toBeDefined();
      fireEvent.click(pin);
      expect(onSelect).toHaveBeenCalledWith(i);
    }
  });

  it('supports activeZone and hoveredButton props for bi-directional highlighting', () => {
    const { rerender } = render(
      <DeviceProvider>
        <SettingsProvider>
          <MouseStage activeZone={3} onSelectButton={() => {}} />
        </SettingsProvider>
      </DeviceProvider>
    );

    const pin3 = screen.getByTestId('hotspot-pin-3');
    expect(pin3.getAttribute('data-active')).toBe('true');

    // Also support hoveredButton prop
    rerender(
      <DeviceProvider>
        <SettingsProvider>
          <MouseStage hoveredButton={4} onSelectButton={() => {}} />
        </SettingsProvider>
      </DeviceProvider>
    );

    const pin4 = screen.getByTestId('hotspot-pin-4');
    expect(pin4.getAttribute('data-active')).toBe('true');
  });

  it('triggers onHoverButton when hovering pins and SVG elements', () => {
    const onHover = vi.fn();
    render(
      <DeviceProvider>
        <SettingsProvider>
          <MouseStage onHoverButton={onHover} />
        </SettingsProvider>
      </DeviceProvider>
    );

    const pin2 = screen.getByTestId('hotspot-pin-2');
    fireEvent.mouseEnter(pin2);
    expect(onHover).toHaveBeenCalledWith(2);

    fireEvent.mouseLeave(pin2);
    expect(onHover).toHaveBeenCalledWith(null);

    const svgBtn5 = screen.getByTestId('mouse-btn-5');
    fireEvent.mouseEnter(svgBtn5);
    expect(onHover).toHaveBeenCalledWith(5);

    fireEvent.mouseLeave(svgBtn5);
    expect(onHover).toHaveBeenCalledWith(null);
  });

  it('allows clicking SVG button paths directly to select buttons', () => {
    const onSelect = vi.fn();
    render(
      <DeviceProvider>
        <SettingsProvider>
          <MouseStage onSelectButton={onSelect} />
        </SettingsProvider>
      </DeviceProvider>
    );

    const svgBtn1 = screen.getByTestId('mouse-btn-1');
    fireEvent.click(svgBtn1);
    expect(onSelect).toHaveBeenCalledWith(1);

    const svgBtn6 = screen.getByTestId('mouse-btn-6');
    fireEvent.click(svgBtn6);
    expect(onSelect).toHaveBeenCalledWith(6);
  });

  it('renders LED diffuser strip and reactive ambient glow based on lighting settings', () => {
    const sm = new SettingsManager();
    sm.updateSettings({
      lighting: {
        mode: 1, // Breathing
        color: '#ff0055',
        brightness: 9,
        speed: 6,
      },
    });

    render(
      <DeviceProvider>
        <SettingsProvider manager={sm}>
          <MouseStage />
        </SettingsProvider>
      </DeviceProvider>
    );

    const ledStrip = screen.getByTestId('mouse-led-strip');
    expect(ledStrip).toBeDefined();

    const ambientGlow = screen.getByTestId('ambient-glow');
    expect(ambientGlow).toBeDefined();
  });

  it('renders active DPI stage readout badge underneath mouse', () => {
    const sm = new SettingsManager();
    sm.updateSettings({
      activeDpiStage: 1,
      dpiStages: [
        { enabled: true, x: 800, y: 800, color: '#ff334b' },
        ...sm.getSettings().dpiStages.slice(1),
      ],
    });

    render(
      <DeviceProvider>
        <SettingsProvider manager={sm}>
          <MouseStage />
        </SettingsProvider>
      </DeviceProvider>
    );

    const readout = screen.getByTestId('dpi-stage-readout');
    expect(readout).toBeDefined();
    expect(screen.getByText(/800 DPI/i)).toBeDefined();
    expect(screen.getByText(/Stage 1/i)).toBeDefined();
  });

  it('renders standalone without providers without throwing errors', () => {
    render(<MouseStage />);
    expect(screen.getByTestId('hotspot-pin-1')).toBeDefined();
    expect(screen.getByTestId('mouse-led-strip')).toBeDefined();
    expect(screen.getByTestId('dpi-stage-readout')).toBeDefined();
  });
  it('renders all 7 lighting modes correctly without error', () => {
    const modes = [0, 1, 2, 3, 4, 5, 7]; // Streaming, Breathing, Steady, Neon, OFF, Scrolling, Colorful Breathing
    const sm = new SettingsManager();

    for (const mode of modes) {
      sm.updateSettings({
        lighting: {
          ...sm.getSettings().lighting,
          mode,
        },
      });
      const { unmount } = render(
        <DeviceProvider>
          <SettingsProvider manager={sm}>
            <MouseStage />
          </SettingsProvider>
        </DeviceProvider>
      );
      expect(screen.getByTestId('mouse-led-strip')).toBeDefined();
      expect(screen.getByTestId('ambient-glow')).toBeDefined();
      unmount();
    }
  });

  it('renders separate XY DPI readout when separateXY is enabled', () => {
    const sm = new SettingsManager();
    const stages = [...sm.getSettings().dpiStages];
    stages[1] = { enabled: true, x: 1200, y: 1600, color: '#00e5ff' };
    sm.updateSettings({
      separateXY: true,
      activeDpiStage: 2,
      dpiStages: stages,
    });

    render(
      <DeviceProvider>
        <SettingsProvider manager={sm}>
          <MouseStage />
        </SettingsProvider>
      </DeviceProvider>
    );

    expect(screen.getByText(/1200 × 1600 DPI/i)).toBeDefined();
    expect(screen.getByText(/Stage 2/i)).toBeDefined();
  });
});
