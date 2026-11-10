// @vitest-environment jsdom
import React from 'react';
import { afterEach,beforeEach,describe,it,expect,vi } from 'vitest';
import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import axe from 'axe-core';
import App from '../src/App';
import { normalize } from '../server/normalize';
const [unknown]=normalize({type:'node',id:1,lat:-33.8688,lon:151.2093,tags:{amenity:'toilets',name:'A toilet with unknown details'}});
const [known]=normalize({type:'node',id:2,lat:-33.869,lon:151.209,tags:{amenity:'drinking_water',name:'Public refill',access:'yes',fee:'no',wheelchair:'yes'}});
const results={places:[unknown,known],center:{lat:-33.8688,lon:151.2093},evidence:{},fetchedAt:new Date().toISOString(),stale:false,attribution:'OSM'};
beforeEach(()=>{
  localStorage.clear();location.hash='';
  HTMLElement.prototype.scrollIntoView=vi.fn();
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>({ok:true,json:async()=>url.includes('/config')?{reportsEnabled:false,tileUrl:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',tileAttribution:'OSM'}:url.includes('/search')?{results:[]}:results})));
});afterEach(()=>{cleanup();vi.unstubAllGlobals();});
describe('account-free accessible finding flow',()=>{
  it('has a complete list without loading the map and applies strict unknown filters',async()=>{render(<App/>);await screen.findByText('A toilet with unknown details');expect(screen.getByText('Public refill')).toBeVisible();expect(screen.getByRole('button',{name:'Show map'})).toBeEnabled();fireEvent.click(screen.getByRole('button',{name:'No fee mapped'}));expect(screen.queryByText('A toilet with unknown details')).not.toBeInTheDocument();expect(screen.getByText('Public refill')).toBeVisible();});
  it('opens keyboard-focusable details with provenance and returns to the result',async()=>{render(<App/>);const card=await screen.findByRole('button',{name:/A toilet with unknown/});fireEvent.click(card);expect(screen.getByRole('heading',{name:'A toilet with unknown details'})).toHaveFocus();expect(screen.getByText('Public access not confirmed')).toBeVisible();expect(screen.getByText('No recent, reviewed community observations.')).toBeVisible();expect(screen.getByRole('link',{name:/View or correct/})).toHaveAttribute('href','https://www.openstreetmap.org/node/1');fireEvent.click(screen.getByRole('button',{name:'All results'}));await waitFor(()=>expect(screen.getByRole('button',{name:/A toilet with unknown/})).toHaveFocus());});
  it('supports coordinates without making a geocoder request',async()=>{render(<App/>);await screen.findByText('Public refill');fireEvent.change(screen.getByRole('textbox',{name:/Search a city/}),{target:{value:'51.5, -0.12'}});fireEvent.click(screen.getByRole('button',{name:'Find places'}));await waitFor(()=>expect(fetch).toHaveBeenCalledWith('/api/nearby?lat=51.500&lon=-0.120',expect.anything()));expect(vi.mocked(fetch).mock.calls.some(c=>String(c[0]).includes('/api/search'))).toBe(false);});
  it('saves an area only after the explicit save action',async()=>{render(<App/>);await screen.findByText('Public refill');expect(localStorage.length).toBe(0);fireEvent.click(screen.getByRole('button',{name:'Save this area on this device'}));expect(localStorage.getItem('open-amenities:saved:v1')).toContain('Public refill');expect(screen.getByRole('status')).toHaveTextContent('Area saved');});
  it('passes automated structural accessibility checks for list and details',async()=>{const {container}=render(<App/>);await screen.findByText('Public refill');const opts={rules:{'color-contrast':{enabled:false}}};expect((await axe.run(container,opts)).violations).toEqual([]);fireEvent.click(screen.getByRole('button',{name:/A toilet with unknown/}));expect((await axe.run(container,opts)).violations).toEqual([]);});
});

it('does not call a plain fragment link a shared area after reload',async()=>{
  location.hash='#about';render(<App/>);await screen.findByText('Public refill');expect(screen.getByText('Sydney · starting area')).toBeVisible();expect(screen.queryByText('Shared area')).not.toBeInTheDocument();
});
it('does not advertise seasonal 24-hour source text as unconditional 24/7 access',async()=>{
  const seasonal={...unknown,hours:'24/7',aroundTheClock:false};
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>({ok:true,json:async()=>url.includes('/config')?{reportsEnabled:false,tileUrl:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',tileAttribution:'OSM'}:{...results,places:[seasonal]}})));
  render(<App/>);await screen.findByText('A toilet with unknown details');expect(screen.getByText(/Hours recorded/)).toBeVisible();expect(screen.queryByText(/24\/7 mapped/)).not.toBeInTheDocument();
});
it('keeps a later manual area choice when an older GPS callback arrives',async()=>{
  let success:PositionCallback|undefined;
  Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition:(callback:PositionCallback)=>{success=callback;}}});
  render(<App/>);await screen.findByText('Public refill');fireEvent.click(screen.getByRole('button',{name:'Use my location'}));
  fireEvent.change(screen.getByRole('textbox',{name:/Search a city/}),{target:{value:'51.5, -0.12'}});fireEvent.click(screen.getByRole('button',{name:'Find places'}));
  await screen.findByText('Area near 51.5, -0.12');
  const calls=vi.mocked(fetch).mock.calls.length;
  success!({coords:{latitude:1,longitude:2,accuracy:20}} as GeolocationPosition);
  expect(vi.mocked(fetch).mock.calls).toHaveLength(calls);expect(screen.getByText('Area near 51.5, -0.12')).toBeVisible();
});

it('retains an expired unsafe-water report as a historical caution when restoring in the connected app',async()=>{
  const evidence={[known.id]:[{type:'not-drinkable',observedOn:'2026-01-01',reviewedAt:'2026-01-02',expiresAt:new Date(Date.now()-86400000).toISOString()}]};
  localStorage.setItem('open-amenities:saved:v1',JSON.stringify({label:'Saved test area',result:{...results,evidence}}));
  render(<App/>);await screen.findByText('Public refill');
  fireEvent.click(screen.getByRole('button',{name:'Open saved area'}));
  expect(screen.getByText('Past unsafe-water report: current status unknown')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:/Public refill/}));
  expect(screen.getByText('Previously reported unsafe water; current water safety is unknown.')).toBeInTheDocument();
});
it('shows both an active closure caution and an expired saved unsafe-water caution',async()=>{
  const evidence={[known.id]:[{type:'not-drinkable',observedOn:'2026-01-01',reviewedAt:'2026-01-02',expiresAt:new Date(Date.now()-86400000).toISOString()},{type:'closed',observedOn:new Date().toISOString().slice(0,10),reviewedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString()}]};
  localStorage.setItem('open-amenities:saved:v1',JSON.stringify({label:'Saved test area',result:{...results,evidence}}));
  render(<App/>);await screen.findByText('Public refill');fireEvent.click(screen.getByRole('button',{name:'Open saved area'}));
  expect(screen.getByText('Recent caution report')).toBeInTheDocument();expect(screen.getByText('Past unsafe-water report: current status unknown')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:/Public refill/}));
  expect(screen.getByText('Recent access or closure report.')).toBeInTheDocument();expect(screen.getByText('Previously reported unsafe water; current water safety is unknown.')).toBeInTheDocument();
});
it('keeps recovery controls when an HTTP-200 response contains the wrong JSON shape',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({error:'Unexpected gateway payload'})})));
  render(<App/>);expect(await screen.findByText('We couldn’t load this area.')).toBeInTheDocument();expect(screen.getByText('The server returned invalid map data. Please try again.')).toBeInTheDocument();expect(screen.getByRole('button',{name:'Try again'})).toBeEnabled();
});
