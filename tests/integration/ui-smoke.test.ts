import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('UI Bundle and Static Asset Smoke Test', () => {
  const webDistPath = path.resolve(__dirname, '../../apps/web/dist');

  it('generates production index.html', () => {
    const indexPath = path.join(webDistPath, 'index.html');
    expect(fs.existsSync(indexPath)).toBe(true);
    const content = fs.readFileSync(indexPath, 'utf-8');
    expect(content).toContain('<!DOCTYPE html>');
    expect(content).toContain('Drone Property Patrol');
  });

  it('generates compiled JavaScript and CSS bundles with no missing assets', () => {
    const assetsDir = path.join(webDistPath, 'assets');
    expect(fs.existsSync(assetsDir)).toBe(true);

    const files = fs.readdirSync(assetsDir);
    const jsFiles = files.filter((f) => f.endsWith('.js'));
    const cssFiles = files.filter((f) => f.endsWith('.css'));

    expect(jsFiles.length).toBeGreaterThan(0);
    expect(cssFiles.length).toBeGreaterThan(0);

    // Verify bundle size is reasonable
    const jsStat = fs.statSync(path.join(assetsDir, jsFiles[0]));
    expect(jsStat.size).toBeGreaterThan(50000); // contains React, Leaflet, and UI components
  });
});
