import { useState } from 'react';
import { ar, interpolate } from '@/locales/ar';
import type { Vehicle } from '../types';

const t = ar.vehicles.detail;

/** Primary image first; thumbnails switch the large image. Images are public storage URLs. */
export function VehicleGallery({ images, name }: { images: Vehicle['images']; name: string }) {
  const ordered = [...(images ?? [])].sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = ordered.find((image) => image.id === selectedId) ?? ordered[0];

  if (!selected) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-lg border border-dashed border-border-strong bg-surface text-sm text-fg-muted">
        {t.noImages}
      </div>
    );
  }

  const total = ordered.length;
  const indexOf = (id: number) => ordered.findIndex((image) => image.id === id) + 1;

  return (
    <div className="flex flex-col gap-3">
      <img
        src={selected.url}
        alt={interpolate(t.imageAlt, { index: indexOf(selected.id), total, name })}
        className="aspect-[4/3] w-full rounded-lg border border-border bg-surface-muted object-cover"
      />
      {total > 1 ? (
        <ul className="flex gap-2 overflow-x-auto pb-1">
          {ordered.map((image, i) => (
            <li key={image.id} className="shrink-0">
              <button
                type="button"
                aria-label={interpolate(t.showImage, { index: i + 1 })}
                aria-pressed={image.id === selected.id}
                className={`block overflow-hidden rounded-md border-2 ${
                  image.id === selected.id ? 'border-accent' : 'border-transparent'
                }`}
                onClick={() => {
                  setSelectedId(image.id);
                }}
              >
                <img src={image.url} alt="" className="h-14 w-20 object-cover" loading="lazy" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
