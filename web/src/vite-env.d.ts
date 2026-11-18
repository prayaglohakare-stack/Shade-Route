/// <reference types="vite/client" />

declare module '*.osm?raw' {
  const source: string;
  export default source;
}

declare module '*.geojson' {
  const value: any;
  export default value;
}

