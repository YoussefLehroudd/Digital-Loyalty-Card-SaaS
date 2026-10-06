declare module "*.css" {
  const content: Record<string, string>;
  export default content;
}
declare module "*.css" {
  // allow plain side-effect imports like `import "./globals.css";`
}
