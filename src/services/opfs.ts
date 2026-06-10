/**
 * Utilities for interacting with the Origin Private File System (OPFS).
 * This provides raw, high-performance file access on the client side,
 * ideal for disk caching of huge raster assets, autosave logs, and export pipelines.
 */

export async function getOpfsRoot(): Promise<FileSystemDirectoryHandle | null> {
  if (!navigator.storage || !navigator.storage.getDirectory) {
    console.warn('OPFS is not supported in this browser environment.');
    return null;
  }
  return await navigator.storage.getDirectory();
}

export async function writeToOpfs(fileName: string, data: Blob | ArrayBuffer | string): Promise<boolean> {
  try {
    const root = await getOpfsRoot();
    if (!root) return false;

    // Access or create file
    const fileHandle = await root.getFileHandle(fileName, { create: true });
    
    // Create a FileSystemWritableFileStream to write to
    // @ts-ignore - createWritable might not be in the base TS lib but exists in OPFS spec
    const writable = await fileHandle.createWritable();
    await writable.write(data);
    await writable.close();
    
    return true;
  } catch (error) {
    console.error(`OPFS Write Error [${fileName}]:`, error);
    return false;
  }
}

export async function readFromOpfs(fileName: string): Promise<Blob | null> {
  try {
    const root = await getOpfsRoot();
    if (!root) return null;

    const fileHandle = await root.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    return file;
  } catch (error) {
    console.error(`OPFS Read Error [${fileName}]:`, error);
    return null;
  }
}

export async function deleteFromOpfs(fileName: string): Promise<boolean> {
  try {
    const root = await getOpfsRoot();
    if (!root) return false;

    await root.removeEntry(fileName);
    return true;
  } catch (error) {
    console.error(`OPFS Delete Error [${fileName}]:`, error);
    return false;
  }
}

export async function listOpfsFiles(): Promise<string[]> {
  try {
    const root = await getOpfsRoot();
    if (!root) return [];

    const files: string[] = [];
    // @ts-ignore - async iterator on directory handle entries
    for await (const entry of root.values()) {
      if (entry.kind === 'file') {
        files.push(entry.name);
      }
    }
    return files;
  } catch (error) {
    console.error('OPFS List Directory Error:', error);
    return [];
  }
}
