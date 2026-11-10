import {describe,it,expect} from 'vitest';
import {publicOrigin} from '../server/config';
describe('deployment origin',()=>{
  it('normalizes a trailing slash so browser reports match',()=>{expect(publicOrigin('https://amenities.example/',true)).toBe('https://amenities.example');});
  it.each(['https://example.org/path','https://user:pass@example.org','https://example.org/?x=1','http://example.org','invalid'])('rejects a non-HTTPS production origin or non-origin URL: %s',value=>expect(()=>publicOrigin(value,true)).toThrow());
});
