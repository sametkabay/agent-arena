/// <reference types="vite/client" />

declare module "*.yaml" {
  const value: unknown;
  export default value;
}

declare module "*.yml" {
  const value: unknown;
  export default value;
}

declare module "@data/*" {
  const value: unknown;
  export default value;
}
