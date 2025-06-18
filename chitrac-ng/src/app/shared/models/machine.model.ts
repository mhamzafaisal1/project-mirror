import { Deserializable } from './deserializable.model';

export class MachineConfig implements Deserializable {
  public _id: string;
  public serial: number;
  public name: string;
  public active: boolean;
  public ipAddress: string;
  public lanes: number;

  deserialize(input: any) {
    Object.assign(this, input);
    return this;
  }
}
