import type { OpenableObject } from '../types';

export const OPENABLES_DATA = {
  workbasket: {
    id: 'workbasket',
    defaultState: 'closed',
    openProse:
      'The japanned tin box sat heavily within the workbasket, its black surface dulled by a fine layer of dust. Watson found the lid catch remarkably stiff, as if the metal had protested against being disturbed after so many months of neglect. While Holmes stood at the window with his hands behind his back, perfectly still, Watson applied a firm pressure to the fastening. The resistance of the spring reminds him of a surgical clamp left too long in the steriliser.',
    closeProse:
      'Watson returns the tin box to the workbasket and secures the lid. It remains stubbornly shut, preserving the secrets of the unfortunate Nell beneath its unremarkable exterior. Without a key or a more forceful intervention, the contents of this private repository stayed hidden, leaving him only with the silent testimony of its worn, utilitarian edges.',
  } satisfies OpenableObject,
} satisfies Record<string, OpenableObject>;

export type OpenableId = keyof typeof OPENABLES_DATA;

export const OPENABLES: Record<string, OpenableObject> = OPENABLES_DATA;
