import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));

const geojsonPlugin: Plugin = {
  name: 'vite-plugin-geojson',
  transform(code, id) {
    if (id.endsWith('.geojson')) {
      return {
        code: `export default JSON.parse(${JSON.stringify(code)});`,
        map: null,
      };
    }
  },
};

export default defineConfig({
  base: '/Shade-Route/',
  plugins: [react(), geojsonPlugin],
  server: {
    fs: { allow: [projectRoot] },
  },
});
