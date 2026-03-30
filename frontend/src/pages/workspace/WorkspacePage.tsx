import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { WorkspaceShell } from '@widgets/workspace-shell';
import { useWorkspaceRuntimeRoute } from './hooks/useWorkspaceRuntimeRoute';

export function WorkspacePage() {
  const { voltId } = useParams<{ voltId: string }>();
  const navigate = useNavigate();
  const workspace = useWorkspaceRuntimeRoute(voltId, navigate);

  if (!workspace || !voltId) {
    return null;
  }

  return <WorkspaceShell voltId={voltId} voltPath={workspace.voltPath} />;
}
