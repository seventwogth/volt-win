import type { GraphData } from './types';
import { invokeWails } from '@api/wails';

const loadGraphHandler = () => import('../../../wailsjs/go/wailshandler/GraphHandler');

export async function getGraph(voltPath: string): Promise<GraphData> {
  return invokeWails(loadGraphHandler, (mod) => mod.GetGraph(voltPath));
}
