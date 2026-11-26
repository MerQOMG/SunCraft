import type { LinkTarget } from './report';
import type { SpatialOwner } from './spatial';
export interface InspectionState {
  candidate: SpatialOwner | null;
  selected: SpatialOwner | null;
}
export type InspectionAction =
  | { type: 'focus' | 'activate'; owner: SpatialOwner }
  | { type: 'navigate'; view: 'score' | 'date' | 'cases' }
  | { type: 'forget-candidate' | 'clear' };
export const EMPTY_INSPECTION: InspectionState = { candidate: null, selected: null };
/** Focus is only a navigation candidate. Only an explicit activation pins the annotation. */
export function inspectionReducer(
  state: InspectionState,
  action: InspectionAction,
): InspectionState {
  switch (action.type) {
    case 'focus':
      return {
        candidate: action.owner.target === 'winter-depth' ? action.owner : null,
        selected: null,
      };
    case 'activate':
      return action.owner.target === 'winter-depth'
        ? { candidate: null, selected: action.owner }
        : EMPTY_INSPECTION;
    case 'navigate':
      return action.view === 'cases'
        ? { candidate: null, selected: state.selected ?? state.candidate }
        : EMPTY_INSPECTION;
    case 'forget-candidate':
      return state.candidate ? { ...state, candidate: null } : state;
    case 'clear':
      return state.candidate || state.selected ? EMPTY_INSPECTION : state;
  }
}
export function inspectionTarget(
  open: boolean,
  view: 'score' | 'date' | 'cases',
  transient: LinkTarget | null,
  state: InspectionState,
): LinkTarget | null {
  return !open
    ? null
    : view === 'score'
      ? transient
      : view === 'cases'
        ? (state.selected?.target ?? null)
        : null;
}
