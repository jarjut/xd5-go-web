import React, { useRef } from 'react';
import { Target, Sun, Mouse, SlidersHorizontal, Terminal } from 'lucide-react';
export type TabId = 'dpi' | 'lighting' | 'remap' | 'sensor' | 'diagnostics';
export interface TabItem { id: TabId; label: string; icon: React.ComponentType<{ className?: string }>; }
export const TABS: TabItem[] = [
  { id:'dpi', label:'DPI', icon:Target },
  { id:'remap', label:'Buttons', icon:Mouse },
  { id:'lighting', label:'Lights', icon:Sun },
  { id:'sensor', label:'Sensor', icon:SlidersHorizontal },
  { id:'diagnostics', label:'Device log', icon:Terminal },
];
export interface TabNavProps { activeTab: TabId; onTabChange: (tabId: TabId) => void; className?: string; }
export const TabNav: React.FC<TabNavProps> = ({ activeTab, onTabChange, className = '' }) => {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  return <nav aria-label="Mouse settings" className={className}><div role="tablist" aria-label="Mouse settings" className="studio-tabs">{TABS.map((tab,index) => <button ref={node => { buttons.current[index] = node; }} key={tab.id} type="button" role="tab" id={`tab-${tab.id}`} aria-controls={`panel-${tab.id}`} aria-selected={activeTab === tab.id} tabIndex={activeTab === tab.id ? 0 : -1} className="studio-tab" onClick={() => onTabChange(tab.id)} onKeyDown={event => {
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % TABS.length;
    else if (event.key === 'ArrowLeft') next = (index + TABS.length - 1) % TABS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = TABS.length - 1;
    else return;
    event.preventDefault(); onTabChange(TABS[next].id); buttons.current[next]?.focus();
  }}>{tab.label}</button>)}</div></nav>;
};
