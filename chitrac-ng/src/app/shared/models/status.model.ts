import { Deserializable } from './deserializable.model';

export class StatusConfig implements Deserializable {
	public code: number;
	public name: string;
	public jam: number;
	public softrolColor: string;

	deserialize(input: any) {
        Object.assign(this, input);
        return this;
    }
}