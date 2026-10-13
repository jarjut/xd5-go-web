import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import App from '../App';

beforeEach(() => { localStorage.clear(); });
afterEach(() => { cleanup(); });
describe('workbench interactions', () => {
  it('keeps the mouse mounted through keyboard tab transitions', () => {
    render(<App/>);
    const mouse = screen.getByTestId('mouse-stage');
    const dpi = screen.getByRole('tab', {name:'DPI'});
    dpi.focus();
    fireEvent.keyDown(dpi, {key:'End'});
    expect(document.activeElement).toBe(screen.getByRole('tab', {name:'Device log'}));
    expect(screen.getByRole('tabpanel').id).toBe('panel-diagnostics');
    expect(screen.getByTestId('mouse-stage')).toBe(mouse);
    fireEvent.keyDown(document.activeElement!, {key:'ArrowRight'});
    expect(document.activeElement).toBe(dpi);
    expect(screen.getByRole('tabpanel').id).toBe('panel-dpi');
    fireEvent.keyDown(dpi, {key:'ArrowLeft'});
    expect(screen.getByRole('tabpanel').id).toBe('panel-diagnostics');
    fireEvent.keyDown(document.activeElement!, {key:'Home'});
    expect(document.activeElement).toBe(dpi);
  });
  it('opens the matching button binding when a mouse hotspot is selected', () => {
    render(<App/>);
    fireEvent.click(screen.getByTestId('hotspot-pin-4'));
    expect(screen.getByRole('tabpanel').id).toBe('panel-remap');
    expect(screen.getByTestId('key-remap-card-4').getAttribute('data-focused')).toBe('true');
  });
  it('keeps local changes editable while hardware actions are unavailable', () => {
    render(<App/>);
    fireEvent.click(screen.getByRole('checkbox', {name:'Separate X & Y DPI'}));
    expect((screen.getByRole('button', {name:'Reload from mouse'}) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Mouse not connected')).toBeDefined();
    fireEvent.click(screen.getByRole('button', {name:'Use light theme'}));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(screen.getByText('Mouse not connected')).toBeDefined();
  });
});
