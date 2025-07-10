import { Deserializable } from './deserializable.model';

export class ItemConfig implements Deserializable {
	public _id: string;
	public number: number;
	public name: string;
	public active: boolean;
	public weight?: number | null; // optional field

	deserialize(input: any) {
		Object.assign(this, input);
		return this;
	}
}
