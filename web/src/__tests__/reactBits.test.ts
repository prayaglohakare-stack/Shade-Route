import { describe, it, expect } from 'vitest';
import Topography from '../components/react-bits/Topography/Topography';
import TargetCursor from '../components/react-bits/TargetCursor/TargetCursor';
import TechText from '../components/react-bits/TechText/TechText';

describe('React Bits Components Integration', () => {
  it('exports Topography component as a valid React component function', () => {
    expect(Topography).toBeDefined();
    expect(typeof Topography).toBe('function');
  });

  it('exports TargetCursor component as a valid React component function', () => {
    expect(TargetCursor).toBeDefined();
    expect(typeof TargetCursor).toBe('function');
  });

  it('exports TechText component as a valid React component function', () => {
    expect(TechText).toBeDefined();
    expect(typeof TechText).toBe('function');
  });
});
