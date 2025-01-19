export async function loadWasmModule(
  path: string,
): Promise<WebAssembly.Module> {
  const response = await fetch(path);
  const bytes = await response.arrayBuffer();
  return WebAssembly.compile(bytes);
}
