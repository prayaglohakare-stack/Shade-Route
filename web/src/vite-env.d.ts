/// <reference types="vite/client" />

declare module '*.osm?raw' {
  const source: string;
  export default source;
}
