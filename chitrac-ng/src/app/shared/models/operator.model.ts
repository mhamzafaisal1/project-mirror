import { Deserializable } from './deserializable.model';

export class OperatorConfig implements Deserializable {
	public _id: string;
	public code: number;
	public name: string;
	public active: boolean;

	deserialize(input: any) {
        Object.assign(this, input);
        return this;
    }
}