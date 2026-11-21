import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Dialog } from './Dialog';

function Harness({ unmountOnClose }: { unmountOnClose: boolean }) {
  const [open, setOpen] = useState(false);
  const close = () => {
    setOpen(false);
  };
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
      >
        open
      </button>
      {unmountOnClose && !open ? null : (
        <Dialog open={open} onClose={close} title="Confirm" description="Are you sure?">
          <button type="button" onClick={close}>
            done
          </button>
        </Dialog>
      )}
    </>
  );
}

describe('Dialog', () => {
  it.each([
    ['closed', false],
    ['unmounted', true],
  ])('returns focus to the trigger when %s', async (_label, unmountOnClose) => {
    const user = userEvent.setup();
    render(<Harness unmountOnClose={unmountOnClose} />);
    const trigger = screen.getByRole('button', { name: 'open' });

    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Confirm' });
    expect(dialog).toHaveAccessibleDescription('Are you sure?');

    await user.click(screen.getByRole('button', { name: 'done' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
