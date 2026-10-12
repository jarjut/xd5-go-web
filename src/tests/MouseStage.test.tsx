import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MouseStage } from '../components/stage/MouseStage';
import { ProfileProvider } from '../context/ProfileContext';
import { DeviceProvider } from '../context/DeviceContext';
import { ProfileManager } from '../core/profiles';

describe('MouseStage', () => {
  it('renders interactive button pins and triggers selection', () => {
    const onSelect = vi.fn();
    render(
      <DeviceProvider>
        <ProfileProvider>
          <MouseStage hoveredButton={null} onSelectButton={onSelect} />
        </ProfileProvider>
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
        <ProfileProvider>
          <MouseStage activeZone={null} onSelectButton={onSelect} />
        </ProfileProvider>
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
        <ProfileProvider>
          <MouseStage activeZone={3} onSelectButton={() => {}} />
        </ProfileProvider>
      </DeviceProvider>
    );

    const pin3 = screen.getByTestId('hotspot-pin-3');
    expect(pin3.getAttribute('data-active')).toBe('true');

    // Also support hoveredButton prop
    rerender(
      <DeviceProvider>
        <ProfileProvider>
          <MouseStage hoveredButton={4} onSelectButton={() => {}} />
        </ProfileProvider>
      </DeviceProvider>
    );

    const pin4 = screen.getByTestId('hotspot-pin-4');
    expect(pin4.getAttribute('data-active')).toBe('true');
  });

  it('triggers onHoverButton when hovering pins and SVG elements', () => {
    const onHover = vi.fn();
    render(
      <DeviceProvider>
        <ProfileProvider>
          <MouseStage onHoverButton={onHover} />
        </ProfileProvider>
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
        <ProfileProvider>
          <MouseStage onSelectButton={onSelect} />
        </ProfileProvider>
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
    const pm = new ProfileManager();
    const customProfile = pm.getActiveProfile();
    customProfile.lighting = {
      mode: 1, // Breathing
      color: '#ff0055',
      brightness: 9,
      speed: 6,
    };

    render(
      <DeviceProvider>
        <ProfileProvider manager={pm}>
          <MouseStage />
        </ProfileProvider>
      </DeviceProvider>
    );

    const ledStrip = screen.getByTestId('mouse-led-strip');
    expect(ledStrip).toBeDefined();

    const ambientGlow = screen.getByTestId('ambient-glow');
    expect(ambientGlow).toBeDefined();
  });

  it('renders active DPI stage readout badge underneath mouse', () => {
    const pm = new ProfileManager();
    const profile = pm.getActiveProfile();
    profile.activeDpiStage = 1;
    profile.dpiStages[0] = { enabled: true, x: 800, y: 800, color: '#ff334b' };

    render(
      <DeviceProvider>
        <ProfileProvider manager={pm}>
          <MouseStage />
        </ProfileProvider>
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
    const pm = new ProfileManager();
    const profile = pm.getActiveProfile();

    for (const mode of modes) {
      profile.lighting.mode = mode;
      const { unmount } = render(
        <DeviceProvider>
          <ProfileProvider manager={pm}>
            <MouseStage />
          </ProfileProvider>
        </DeviceProvider>
      );
      expect(screen.getByTestId('mouse-led-strip')).toBeDefined();
      expect(screen.getByTestId('ambient-glow')).toBeDefined();
      unmount();
    }
  });

  it('renders separate XY DPI readout when separateXY is enabled', () => {
    const pm = new ProfileManager();
    const profile = pm.getActiveProfile();
    profile.separateXY = true;
    profile.activeDpiStage = 2;
    profile.dpiStages[1] = { enabled: true, x: 1200, y: 1600, color: '#00e5ff' };

    render(
      <DeviceProvider>
        <ProfileProvider manager={pm}>
          <MouseStage />
        </ProfileProvider>
      </DeviceProvider>
    );

    expect(screen.getByText(/1200 × 1600 DPI/i)).toBeDefined();
    expect(screen.getByText(/Stage 2/i)).toBeDefined();
  });
});
