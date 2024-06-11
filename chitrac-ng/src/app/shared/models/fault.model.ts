import { Deserializable } from './deserializable.model';

export class FaultConfig implements Deserializable {
	public code: number;
	public name: string;
	public jam: number;

	deserialize(input: any) {
        Object.assign(this, input);
        return this;
    }
}