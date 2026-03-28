import { Volt } from './types';
import { invokeWails } from '@api/wails';

const loadVoltHandler = () => import('../../../wailsjs/go/wailshandler/VoltHandler');

export async function listVolts(): Promise<Volt[]> {
  return invokeWails(loadVoltHandler, (mod) => mod.ListVolts());
}

export async function createVolt(name: string, path: string): Promise<Volt> {
  return invokeWails(loadVoltHandler, (mod) => mod.CreateVolt(name, path));
}

export async function deleteVolt(id: string): Promise<void> {
  return invokeWails(loadVoltHandler, (mod) => mod.DeleteVolt(id));
}

export async function selectDirectory(): Promise<string> {
  return invokeWails(loadVoltHandler, (mod) => mod.SelectDirectory());
}
