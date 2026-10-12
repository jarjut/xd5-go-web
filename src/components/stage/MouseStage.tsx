import React, { useContext, useState } from 'react';
import { SettingsContext } from '../../context/SettingsContext';
import { DeviceContext } from '../../context/DeviceContext';
import { MouseSvg } from './MouseSvg';
import { HotspotPin } from './HotspotPin';
import { createDefaultSettings } from '../../core/settings';
import { KEY_CATEGORIES } from '../panels/KeyRemapPanel';
export interface MouseStageProps { activeZone?: number|null; hoveredButton?:number|null; onSelectButton?:(id:number)=>void; onHoverButton?:(id:number|null)=>void; className?:string; }
const defaults = createDefaultSettings();
const actionNames: Record<string, string> = Object.fromEntries(KEY_CATEGORIES.flatMap(category => category.options.map(option => [option.value.toLowerCase(), option.label])));
const buttons = [
  {id:1,label:'Left Click',x:30,y:22}, {id:2,label:'Right Click',x:72,y:23},
  {id:3,label:'Scroll Click',x:52,y:13}, {id:4,label:'Back Button',x:10,y:31},
  {id:5,label:'Forward Button',x:10,y:46}, {id:6,label:'DPI Switch',x:52,y:35},
];
export const MouseStage: React.FC<MouseStageProps> = ({activeZone,hoveredButton,onSelectButton,onHoverButton,className=''}) => {
  const context = useContext(SettingsContext);
  const device = useContext(DeviceContext);
  const settings = context?.settings ?? defaults;
  const [hover,setHover] = useState<number|null>(null);
  const active = activeZone ?? hoveredButton ?? hover;
  const stage = settings.dpiStages[settings.activeDpiStage-1] ?? settings.dpiStages[0];
  const onHover = (id:number|null) => { setHover(id); onHoverButton?.(id); };
  return <div className={className} data-testid="mouse-stage"><div className="stage-body">
    <MouseSvg activeButton={active} lighting={settings.lighting} onSelectButton={onSelectButton} onHoverButton={onHover} className="w-full h-full"/>
    {buttons.map(button => <HotspotPin key={button.id} {...button} sublabel={actionNames[settings.keys[`key${button.id}`]?.toLowerCase()] ?? 'Custom action'} isActive={active === button.id} accentColor={settings.lighting.color} onClick={onSelectButton} onMouseEnter={onHover} onMouseLeave={() => onHover(null)}/>)}
  </div><div className="stage-readout" data-testid="dpi-stage-readout"><span className="w-2 h-2 rounded-full" style={{backgroundColor:stage.color}}/><div><div className="ui-muted">Stage {settings.activeDpiStage}</div><strong>{settings.separateXY ? `${stage.x} × ${stage.y} DPI` : `${stage.x} DPI`}</strong></div>{device?.isConnected && <span data-testid="device-connected-indicator" className="ui-muted">Connected</span>}</div></div>;
};
