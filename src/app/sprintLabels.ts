import { useMemo } from 'react';
import { sprintLabel, sprintState, type SprintState } from '../model/sprints';
import { useWorkspace } from '../workspace/WorkspaceProvider';

export type SprintInfo = SprintState & { label: string };

/** Every sprint's name with its dates, and whether it's over. */
export function useSprintInfo(): Record<string, SprintInfo> {
  const { sprints, companies, pages } = useWorkspace();
  return useMemo(
    () =>
      Object.fromEntries(
        sprints.map((s) => {
          const state = sprintState(s, sprints, companies, pages);
          return [s.id, { ...state, label: sprintLabel(s, state) }];
        }),
      ),
    [sprints, companies, pages],
  );
}
