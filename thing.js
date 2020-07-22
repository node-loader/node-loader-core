export async function resolve(specifier, context, defaultResolve) {
  console.log("resolving", specifier);
  return defaultResolve(specifier, context);
}
