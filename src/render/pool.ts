import type { Object3D, Scene } from "three";

// Reuses one Object3D per still-live entity id, and recycles it back to a
// free list on despawn, so an endless spawn/despawn stream never allocates
// a new mesh mid-run.
export class MeshPool<T extends Object3D> {
  private readonly active = new Map<number, T>();
  private readonly free: T[] = [];

  constructor(
    private readonly scene: Scene,
    private readonly create: () => T,
  ) {}

  sync<E extends { id: number }>(entities: readonly E[], configure: (mesh: T, entity: E) => void): void {
    const wanted = new Set(entities.map((e) => e.id));
    for (const [id, mesh] of this.active) {
      if (wanted.has(id)) continue;
      this.scene.remove(mesh);
      this.free.push(mesh);
      this.active.delete(id);
    }

    for (const entity of entities) {
      const existing = this.active.get(entity.id);
      const mesh = existing ?? this.free.pop() ?? this.create();
      if (!existing) {
        this.scene.add(mesh);
        this.active.set(entity.id, mesh);
      }
      configure(mesh, entity);
    }
  }
}
