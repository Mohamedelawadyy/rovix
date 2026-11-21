import { useRef, useState } from 'react';
import { Card } from '@/components/shared/DetailList';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { getErrorMessage } from '@/lib/api/error-message';
import { isApiError } from '@/lib/api';
import { ar, interpolate } from '@/locales/ar';
import { vehiclesApi } from '../api/vehicles-api';
import { IMAGE_TYPES, validateImage } from '../image-rules';
import type { Vehicle } from '../types';
import { useVehicleMutation } from '../use-vehicle-mutation';

const t = ar.vehicles.images;

/**
 * Upload / delete vehicle photos (`vehicles.update`). The backend can only mark a photo as
 * primary while uploading it; there is no endpoint to change the primary photo afterwards.
 */
export function VehicleImagesManager({
  vehicle,
  onDone,
}: {
  vehicle: Vehicle;
  onDone: (message: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isPrimary, setIsPrimary] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<{ id: number; index: number } | null>(null);
  const images = vehicle.images ?? [];

  const upload = useVehicleMutation(
    (vars: { file: File; isPrimary: boolean }) =>
      vehiclesApi.uploadImage(vehicle.id, vars.file, vars.isPrimary),
    () => {
      setFile(null);
      setIsPrimary(false);
      if (fileRef.current) fileRef.current.value = '';
      onDone(t.uploaded);
    },
  );
  const remove = useVehicleMutation(
    (imageId: number) => vehiclesApi.deleteImage(vehicle.id, imageId),
    () => {
      setToDelete(null);
      onDone(t.removed);
    },
  );

  const uploadError =
    clientError ??
    (upload.error
      ? isApiError(upload.error) && upload.error.kind === 'validation'
        ? (upload.error.fieldError('image') ?? upload.error.message)
        : getErrorMessage(upload.error)
      : null);

  return (
    <Card title={t.title}>
      <div className="flex flex-col gap-4">
        {images.length === 0 ? (
          <p className="text-sm text-fg-muted">{t.empty}</p>
        ) : (
          <ul className="flex flex-wrap gap-3">
            {images.map((image, index) => (
              <li key={image.id} className="relative">
                <img
                  src={image.url}
                  alt=""
                  className="h-20 w-28 rounded-md border border-border object-cover"
                  loading="lazy"
                />
                {image.is_primary ? (
                  <span className="absolute start-1 top-1">
                    <Badge tone="accent">{t.primary}</Badge>
                  </span>
                ) : null}
                <button
                  type="button"
                  aria-label={interpolate(t.delete, { index: index + 1 })}
                  className="absolute end-1 top-1 flex size-7 items-center justify-center rounded-full bg-surface text-danger shadow-sm hover:bg-danger-subtle"
                  onClick={() => {
                    setToDelete({ id: image.id, index: index + 1 });
                  }}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        <form
          className="flex flex-col gap-3 border-t border-border pt-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!file) {
              setClientError(t.chooseFile);
              return;
            }
            upload.mutate({ file, isPrimary });
          }}
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="vehicle-image" className="text-sm font-medium text-fg">
              {t.chooseFile}
            </label>
            <input
              ref={fileRef}
              id="vehicle-image"
              type="file"
              accept={IMAGE_TYPES.join(',')}
              aria-invalid={uploadError ? true : undefined}
              aria-describedby="vehicle-image-help"
              className="text-sm text-fg file:me-3 file:rounded-md file:border file:border-border-strong file:bg-surface file:px-3 file:py-2 file:text-sm"
              onChange={(event) => {
                const chosen = event.target.files?.[0] ?? null;
                upload.reset();
                setClientError(chosen ? validateImage(chosen) : null);
                setFile(chosen && !validateImage(chosen) ? chosen : null);
              }}
            />
            <p
              id="vehicle-image-help"
              className={`text-xs ${uploadError ? 'text-danger' : 'text-fg-muted'}`}
            >
              {uploadError ?? t.rules}
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-fg">
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={(event) => {
                setIsPrimary(event.target.checked);
              }}
            />
            {t.makePrimary}
          </label>
          <div>
            <Button
              type="submit"
              variant="secondary"
              loading={upload.isPending}
              loadingLabel={t.uploading}
            >
              {t.upload}
            </Button>
          </div>
        </form>
      </div>

      {toDelete ? (
        <Dialog
          open
          onClose={() => {
            setToDelete(null);
          }}
          dismissible={!remove.isPending}
          title={t.deleteTitle}
          description={t.deleteBody}
          footer={
            <>
              <Button
                variant="ghost"
                disabled={remove.isPending}
                onClick={() => {
                  setToDelete(null);
                }}
              >
                {ar.vehicles.actions.close}
              </Button>
              <Button
                variant="danger"
                loading={remove.isPending}
                loadingLabel={ar.vehicles.actions.working}
                onClick={() => {
                  remove.mutate(toDelete.id);
                }}
              >
                {ar.vehicles.actions.confirmDelete}
              </Button>
            </>
          }
        >
          {remove.error ? <Alert tone="danger">{getErrorMessage(remove.error)}</Alert> : null}
        </Dialog>
      ) : null}
    </Card>
  );
}
