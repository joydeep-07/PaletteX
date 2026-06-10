import Dexie, { type Table } from 'dexie';
import { LayerMetadata } from '../types/layer';
import { VectorElement } from '../types/vector';

export interface DbProject {
  id: string;
  name: string;
  width: number;
  height: number;
  createdAt: number;
  updatedAt: number;
  thumbnail?: string; // base64 thumbnail string
}

export interface DbLayerData {
  id: string; // layerId
  projectId: string;
  metadata: LayerMetadata;
  pixelData?: Blob; // blob representing PNG representation for raster layers
}

export interface DbVectorData {
  projectId: string;
  elements: VectorElement[];
}

export class PaletteXDatabase extends Dexie {
  projects!: Table<DbProject, string>;
  layers!: Table<DbLayerData, string>;
  vectors!: Table<DbVectorData, string>;

  constructor() {
    super('PaletteXDatabase');
    
    this.version(1).stores({
      projects: 'id, name, createdAt, updatedAt',
      layers: 'id, projectId',
      vectors: 'projectId',
    });
  }
}

export const db = new PaletteXDatabase();

// Utility helpers to save & load complete documents
export async function saveProjectToDb(
  project: DbProject,
  layers: { metadata: LayerMetadata; canvas: HTMLCanvasElement | null }[],
  vectors: VectorElement[]
) {
  try {
    // 1. Save project metadata
    await db.projects.put(project);

    // 2. Save layers, converting active canvases into png blobs
    for (const item of layers) {
      let pixelData: Blob | undefined;
      if (item.canvas && item.metadata.type === 'raster') {
        pixelData = await new Promise<Blob>((resolve) => {
          item.canvas!.toBlob((blob) => resolve(blob || new Blob()), 'image/png');
        });
      }

      await db.layers.put({
        id: item.metadata.id,
        projectId: project.id,
        metadata: item.metadata,
        pixelData,
      });
    }

    // 3. Save vector tree
    await db.vectors.put({
      projectId: project.id,
      elements: vectors,
    });
  } catch (error) {
    console.error('Error saving project to Dexie:', error);
  }
}

export async function loadProjectFromDb(projectId: string) {
  try {
    const project = await db.projects.get(projectId);
    if (!project) return null;

    const layersData = await db.layers.where('projectId').equals(projectId).toArray();
    const vectorData = await db.vectors.get(projectId);

    return {
      project,
      layers: layersData,
      vectors: vectorData?.elements || [],
    };
  } catch (error) {
    console.error('Error loading project from Dexie:', error);
    return null;
  }
}
